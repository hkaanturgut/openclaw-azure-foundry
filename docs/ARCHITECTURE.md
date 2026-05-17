# Architecture

A deep-dive into the design decisions behind `openclaw-azure-foundry`.

---

## Why a VM Over Containers

A virtual machine was chosen over containers (e.g. Azure Container Instances or AKS) for several reasons:

- **Persistent state**: OpenClaw maintains session state, conversation history, and agent workspaces on disk. A VM's persistent OS disk is simpler than managing persistent volumes in a container orchestrator.
- **systemd integration**: The `openclaw gateway` process is managed as a systemd unit, giving clean start/stop/restart semantics, automatic restarts on failure, and `journalctl` log access.
- **Easier SSH debugging**: When something goes wrong with cloud-init or the OpenClaw process, `az ssh vm` gives direct shell access. Exec-ing into a container behind a private endpoint requires additional tooling.
- **Managed identity simplicity**: The VM's system-assigned managed identity is automatically created alongside the VM and can be granted RBAC roles. No separate identity resource to manage.
- **Cost**: A `Standard_B2as_v2` burstable VM (~$30/month) is cost-effective for a single-user AI assistant workload.

---

## Private Networking Design

### Virtual Network: `10.40.0.0/16`

The VNet is divided into two subnets:

| Subnet | CIDR | Purpose |
|--------|------|---------|
| `snet-vm` | `10.40.2.0/24` | VM NIC — protected by NSG |
| `snet-pe` | `10.40.3.0/24` | Private Endpoints — network policies disabled |

### Network Security Group (NSG)

The `nsg-vm-openclaw` NSG is attached to `snet-vm` with the following rules:

**Inbound**

| Priority | Name | Direction | Action |
|----------|------|-----------|--------|
| 100 | DenyAllInboundFromInternet | Inbound | **Deny** |
| 200 | AllowVnetInbound | Inbound | Allow |

**Outbound**

| Priority | Name | Direction | Destination | Port | Action |
|----------|------|-----------|-------------|------|--------|
| 1000 | AllowAADOutbound | Outbound | `AzureActiveDirectory` | 443 | Allow |
| 1010 | AllowKeyVaultOutbound | Outbound | `AzureKeyVault` | 443 | Allow |
| 1020 | AllowCognitiveServicesOutbound | Outbound | `CognitiveServicesManagement` | 443 | Allow |
| 1030 | AllowAzureMonitorOutbound | Outbound | `AzureMonitor` | 443 | Allow |
| 1040 | AllowVnetOutbound | Outbound | `VirtualNetwork` | * | Allow |
| 1050 | AllowHttpsInternetOutbound | Outbound | `Internet` | 443 | Allow |
| 1060 | AllowHttpInternetOutbound | Outbound | `Internet` | 80 | Allow |
| 1070 | AllowDnsOutbound | Outbound | `AzureDNS` | 53/UDP | Allow |
| 4000 | DenyAllOutbound | Outbound | `*` | * | **Deny** |

The VM has **no public IP address**. The only inbound connectivity comes from within the VNet (used by `az ssh vm` via the Azure SSH relay). Outbound traffic is restricted to the Azure service tags and Internet HTTPS/HTTP needed by cloud-init (apt package downloads, Telegram API) and the runtime OpenClaw process.

### Private Endpoints

Both Azure AI Foundry and Key Vault have `publicNetworkAccess: 'Disabled'`. They are only reachable via their respective private endpoints in `snet-pe`:

| Resource | Private Endpoint | DNS Zone |
|----------|-----------------|----------|
| Azure AI Foundry | `pe-foundry-openclaw` | `privatelink.openai.azure.com` |
| Key Vault | `pe-kv-openclaw` | `privatelink.vaultcore.azure.net` |

### Private DNS Zones

Two Private DNS Zones are created and linked to the VNet:

- `privatelink.openai.azure.com` — resolves `oc-foundry-eus2.openai.azure.com` to the private endpoint IP (10.40.3.x)
- `privatelink.vaultcore.azure.net` — resolves `kv-oc-eus2.vault.azure.net` to the private endpoint IP (10.40.3.x)

This ensures that DNS queries from the VM for these endpoints resolve to private IPs — never to the public internet.

---

## Cloud-Init Bootstrap Strategy

The VM's `customData` field contains a base64-encoded `cloud-init.yaml` file, processed by the `compute.bicep` module before encoding:

1. **Bicep `replace()` substitutions** are applied at deployment time, filling in `${KEY_VAULT_NAME}`, `${AI_FOUNDRY_ACCOUNT_NAME}`, and `${ADMIN_USERNAME}` with their actual values.
2. The resulting YAML — with real names but `$SHELL_VAR` placeholders intact — is base64-encoded and passed as `customData`.
3. On first boot, `cloud-init` runs the `runcmd` steps sequentially:

| Step | Description |
|------|-------------|
| Package install | `curl`, `jq`, `unzip`, `gnupg`, `lsb-release`, `nodejs` |
| Azure CLI install | Via Microsoft's signed apt repository (GPG-verified) |
| Managed identity login | `az login --identity` |
| Key Vault secret retrieval | Retry loop (30 attempts × 10s) for RBAC propagation |
| OpenClaw install | Non-interactive install via `OPENCLAW_NONINTERACTIVE=1` |
| Config file creation | `openclaw.json` and `auth-profiles.json` with runtime secrets |
| Credential permissions | `chmod 600` on config files; `chmod 700` on `.openclaw` directories |
| systemd service | Written to `/etc/systemd/system/openclaw.service` |
| Service start | `systemctl enable --now openclaw` |

The retry loop for Key Vault access is critical — Azure RBAC role assignments can take up to 5 minutes to propagate after deployment.

---

## Key Vault + Managed Identity

No credentials are stored in source code, environment variables, or VM images. The flow is:

1. Bicep deploys the VM with a **system-assigned managed identity** — Azure automatically creates a service principal for the VM.
2. Bicep deploys Key Vault with `enableRbacAuthorization: true` and `publicNetworkAccess: 'disabled'`.
3. Bicep creates a role assignment granting the VM's managed identity the **Key Vault Secrets User** role (id: `4633458b-...`) scoped to the Key Vault.
4. At runtime (cloud-init), the VM calls `az keyvault secret show` — authenticated via managed identity, no credentials required.
5. Secrets are written into config files in memory and never written to disk in plaintext outside the config files (which are owned by the `openclaw` user with 600 permissions).

---

## GitHub Actions CI/CD

### OIDC (No Stored Credentials)

The workflows use `azure/login@v2` with `client-id`, `tenant-id`, and `subscription-id` — all non-secret values stored as repository **variables**, not secrets. The actual authentication is done via a short-lived OIDC token issued by GitHub, exchanged for an Azure access token. No service principal client secrets are ever stored.

### Workflow Stages

#### `validate.yml` (on PR)
- Bicep lint: `az bicep build`
- ARM template validation: `az deployment sub validate`
- Shell script linting: `shellcheck`

#### `infra-deploy.yml` (on push to main)
1. **what-if** — Preview all changes with `az deployment sub what-if`
2. **deploy** — Requires `prod` environment approval, then runs `az deployment sub create`
3. **verify** — Waits 5 minutes for cloud-init, then runs validation commands on the VM

#### `openclaw-config.yml` (on openclaw-config/** changes)
- Pushes updated config to the running VM via `az vm run-command invoke`
- Restarts the OpenClaw gateway

---

## Security Posture

| Control | Implementation |
|---------|---------------|
| No public IP on VM | NIC configured with private IP only |
| No inbound internet | NSG rule: Deny Internet → Any (inbound) |
| Restricted outbound traffic | NSG `DenyAllOutbound` catch-all; explicit allows for AAD, Key Vault, Cognitive Services, Azure Monitor, VNet, HTTPS/HTTP, and DNS only |
| All Azure services via private endpoints | `publicNetworkAccess: 'Disabled'` on Foundry & Key Vault |
| No secrets in code | All secrets in Key Vault, retrieved via managed identity |
| No service principal secrets | OIDC federated credentials eliminate stored client secrets |
| SSH access via Azure AD | `az ssh vm` uses Azure AD token + SSH relay |
| Least-privilege VM identity | Only `Key Vault Secrets User` role — read-only on secrets |
| Least-privilege CI/CD identity | `Contributor` + `Role Based Access Control Administrator` (role-assignment operations only) |
| Soft-delete on Key Vault | 7-day retention prevents accidental secret deletion |
| Host-level disk encryption | `encryptionAtHost: true` — temp disks, caches, and host↔storage flows encrypted |
| Credential file permissions | `chmod 600` on `openclaw.json` and `auth-profiles.json`; `chmod 700` on all `.openclaw` directories |
| VM availability zone | VM pinned to a single AZ; OS disk uses `StandardSSD_ZRS` for zone-redundant durability |
| Supply chain integrity | Node.js and Azure CLI installed via GPG-verified apt repositories — no `curl \| bash` |
