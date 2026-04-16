<div align="center">

# 🐾 OpenClaw on Azure Foundry

**Deploy a private AI assistant on Azure with zero stored credentials**

[![Deploy Infrastructure](https://github.com/hkaanturgut/openclaw-azure-foundry/actions/workflows/infra-deploy.yml/badge.svg)](https://github.com/hkaanturgut/openclaw-azure-foundry/actions/workflows/infra-deploy.yml)
[![Validate](https://github.com/hkaanturgut/openclaw-azure-foundry/actions/workflows/validate.yml/badge.svg)](https://github.com/hkaanturgut/openclaw-azure-foundry/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A production-ready reference architecture for running [OpenClaw](https://openclaw.ai) on Azure — connected to Telegram, secured with private endpoints, and fully automated with GitHub Actions CI/CD using OIDC (no stored cloud secrets).

[Getting Started](#-getting-started) · [Architecture](#-architecture) · [Workflows](#-cicd-workflows) · [FAQ](#-faq) · [Contributing](#-contributing)

</div>

---

## ✨ Features

- 🔐 **Zero stored credentials** — GitHub Actions authenticates via OIDC federation with Entra ID
- 🏰 **Fully private networking** — VM has no public IP; AI Services and Key Vault use private endpoints only
- 🤖 **Telegram integration** — Chat with GPT-4o through a Telegram bot with pairing-based access control
- 🚀 **One-click bootstrap** — A single workflow creates all Entra ID objects, role assignments, and repo secrets
- 📦 **Infrastructure as Code** — Everything defined in Bicep with parameterized deployments
- ✅ **Approval gates** — Infrastructure changes require manual approval before touching production
- 🔄 **GitOps config management** — Push config changes to `main` and they're automatically applied to the VM

---

## 🏗 Architecture

<div align="center">

![Architecture Diagram](docs/images/architecture.png)

</div>

### How It Works

| Flow | Description |
|------|-------------|
| **User → Telegram → VM** | Messages flow from Telegram to the OpenClaw gateway on a private VM via long polling |
| **VM → Azure AI Services** | OpenClaw calls GPT-4o via the OpenAI Responses API through a private endpoint |
| **VM → Key Vault** | The VM's managed identity reads secrets (API key, bot token) through a private endpoint |
| **GitHub Actions → Azure** | CI/CD authenticates via OIDC federation with Entra ID — no stored service principal secrets |

### Security Model

| Layer | Control |
|-------|---------|
| Network | VM has no public IP; NSG blocks all inbound internet traffic |
| AI Services | Public access disabled; accessible only via private endpoint |
| Key Vault | Public access disabled; accessible only via private endpoint |
| Identity | VM uses managed identity; GitHub Actions uses OIDC federation |
| Access | Telegram bot uses pairing mode — only approved senders can interact |

---

## 📁 Repository Structure

```
openclaw-azure-foundry/
├── .github/workflows/         # CI/CD pipelines
│   ├── bootstrap-oidc.yml     #   One-time Entra ID + repo setup
│   ├── validate.yml           #   PR validation (Bicep lint, ARM check)
│   ├── infra-deploy.yml       #   Infrastructure deployment with approval
│   ├── openclaw-config.yml    #   Config push to VM
│   └── approve-pairing.yml    #   Telegram pairing approval
├── infrastructure/
│   ├── main.bicep             # Root subscription-scope deployment
│   ├── modules/               # Networking, compute, AI, Key Vault, private endpoints
│   ├── parameters/            # Environment parameter files
│   └── cloud-init/            # VM bootstrap (Node.js, Azure CLI, OpenClaw, systemd)
├── openclaw-config/           # Runtime config templates
├── scripts/                   # Operational helpers (connect, validate, teardown)
├── cli/                       # Local CLI for workshop/demo deployments
└── docs/                      # Extended documentation
```

---

## 🔄 CI/CD Workflows

| Workflow | Trigger | What It Does |
|----------|---------|--------------|
| **[Bootstrap OIDC](.github/workflows/bootstrap-oidc.yml)** | Manual | Creates Entra app registration, service principal, federated credentials, role assignments, and sets repo variables/secrets |
| **[Validate](.github/workflows/validate.yml)** | Pull request | Runs Bicep compile/lint, ARM template validation, and shell script linting |
| **[Deploy Infrastructure](.github/workflows/infra-deploy.yml)** | Push to `main` | What-if preview → `prod` approval gate → Bicep deployment → VM health check |
| **[Update Config](.github/workflows/openclaw-config.yml)** | Push to `main` | Renders config templates, fetches secrets on VM via managed identity, restarts OpenClaw |
| **[Approve Pairing](.github/workflows/approve-pairing.yml)** | Manual | Approves a Telegram pairing code for a new user |

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Purpose |
|-------------|---------|
| Azure subscription | With subscription-scope deployment permissions |
| Azure CLI | `az --version` to verify |
| GitHub CLI | `gh auth status` to verify |
| Telegram bot token | From [@BotFather](https://t.me/BotFather) |
| SSH keypair | `ssh-keygen -t ed25519 -C "openclaw"` |
| GitHub classic PAT | With `repo` scope (for bootstrap workflow) |

### Step 1 — Fork & Clone

```bash
# Fork this repo via the GitHub UI, then:
git clone https://github.com/<your-username>/openclaw-azure-foundry.git
cd openclaw-azure-foundry
```

### Step 2 — Store the Bootstrap PAT

Create a GitHub [classic PAT](https://github.com/settings/tokens) with `repo` scope, then add it as a repository secret:

```bash
gh secret set BOOTSTRAP_GH_PAT
```

> **Why a PAT?** The default `GITHUB_TOKEN` cannot create repository variables or secrets. The PAT is only used by the bootstrap workflow.

### Step 3 — Run the Bootstrap Workflow

```bash
gh workflow run bootstrap-oidc.yml
```

Or go to **Actions → Bootstrap OIDC & Repo Settings → Run workflow** in the GitHub UI.

This automatically:
1. Creates an Entra ID app registration and service principal
2. Adds federated credentials for `main`, `pull_request`, and `environment:prod`
3. Assigns `Contributor` and `User Access Administrator` roles on your subscription
4. Sets all required repository variables and secrets

### Step 4 — Create the `prod` Environment

1. Go to **Settings → Environments → New environment**
2. Name it `prod`
3. Add yourself as a required reviewer

> **Note:** Environment protection rules require a **public** repository or a GitHub **Team/Enterprise** plan.

### Step 5 — Customize Parameters

Edit [`infrastructure/parameters/prod.bicepparam`](infrastructure/parameters/prod.bicepparam) and update resource names to be globally unique:

```bicep
param resourceGroupName = 'rg-openclaw'
param aiServicesName    = 'oc-ai-services-<unique>'
param keyVaultName      = 'kv-oc-<unique>'
```

### Step 6 — Deploy

```bash
git add -A && git commit -m "chore: customize parameters" && git push
```

This triggers the deployment pipeline: **what-if → approval → deploy → verify**.

### Step 7 — Push Config

After infrastructure succeeds, trigger the config workflow by pushing a change to `openclaw-config/` or running manually:

```bash
gh workflow run openclaw-config.yml
```

### Step 8 — Pair Your Telegram Bot

1. Message your bot on Telegram — it will return a **pairing code**
2. Run the approval workflow:
   ```bash
   gh workflow run approve-pairing.yml -f pairing_code=YOUR_CODE
   ```

### Step 9 — Chat! 🎉

Send a message to your Telegram bot. You should get a GPT-4o powered response.

---

## 🔧 Operations

### Verify Deployment

```bash
./scripts/validate-deployment.sh
```

### Connect to VM

```bash
az extension add -n ssh
./scripts/connect.sh
```

### Check Service Logs

```bash
# On the VM:
sudo systemctl status openclaw
sudo journalctl -u openclaw -n 100 --no-pager
```

### Rotate Secrets

Update the secret in Key Vault, then re-trigger the config workflow:

```bash
gh workflow run openclaw-config.yml
```

### Teardown

```bash
./scripts/teardown.sh
```

---

## 💻 CLI Mode (Workshop / Demo)

For quick deployments without GitHub Actions:

```bash
cd cli && npm install && npm run build
openclaw-azure init     # Generate config and parameters
openclaw-azure deploy   # Run preflight checks and deploy
```

---

## ⚠️ Common Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| No approval button on deploy | `prod` environment missing or no reviewers | Create environment in **Settings → Environments** |
| `HTTP 403` on bootstrap secrets step | `BOOTSTRAP_GH_PAT` missing or expired | Regenerate PAT with `repo` scope |
| `404 Resource not found` from AI model | Wrong `baseUrl` or `api` in config | Ensure `baseUrl` ends with `/openai/v1` and `api` is `openai-responses` |
| Bot not responding | Pairing not approved or service crashed | Run approve-pairing workflow; check `systemctl status openclaw` |
| Federated credential "duplicate" error | Entra ID eventual consistency | Re-run the bootstrap workflow — it has built-in retry logic |

---

## 💰 Cost Guidance

Primary cost drivers:

- **VM** — SKU and uptime (use `Standard_B2s` for demos)
- **Azure AI Services** — Token usage and provisioned capacity
- **Private endpoints** — Per-endpoint hourly charge

> 💡 **Tip:** Set [Azure budget alerts](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets) early. For demos, teardown resources immediately after.

---

## ❓ FAQ

<details>
<summary><b>Do I have to use GitHub Actions?</b></summary>
<br>
No. You can use CLI mode for quick deployments — ideal for workshops and demos.
</details>

<details>
<summary><b>Is the VM publicly exposed?</b></summary>
<br>
No. The VM has no public IP and is only accessible through Azure tools (<code>az vm run-command</code>, <code>az ssh vm</code>).
</details>

<details>
<summary><b>Where are secrets stored?</b></summary>
<br>
In Azure Key Vault. The VM retrieves them at runtime through its managed identity via a private endpoint. No secrets are stored in the repository.
</details>

<details>
<summary><b>Can I use a different AI model?</b></summary>
<br>
Yes. Update <code>modelName</code> and <code>modelVersion</code> in the parameter file and redeploy.
</details>

<details>
<summary><b>Can I use a different chat platform instead of Telegram?</b></summary>
<br>
OpenClaw supports multiple platforms. Check the <a href="https://openclaw.ai">OpenClaw documentation</a> for available integrations.
</details>

---

## 📚 Additional Documentation

| Document | Description |
|----------|-------------|
| [docs/SETUP.md](docs/SETUP.md) | Detailed command-level setup guide |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Deep architectural rationale |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Failure patterns and fixes |
| [docs/BOOTSTRAP-CHECKLIST.md](docs/BOOTSTRAP-CHECKLIST.md) | Bootstrap automation checklist |

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes and ensure workflows pass
4. **Open** a pull request

Please open an issue first for significant changes to discuss the approach.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by [Kaan Turgut](https://github.com/hkaanturgut)**

⭐ If you found this useful, please consider giving it a star!

</div>
