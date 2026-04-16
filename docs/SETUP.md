# Setup Guide

This guide walks you through everything needed to deploy `openclaw-azure-foundry` from scratch.

---

## 1. OIDC Federation (Azure Entra ID)

GitHub Actions authenticates to Azure using OpenID Connect (OIDC) — no stored service principal secrets required.

### Optional: One-Click Bootstrap via GitHub Actions

If you prefer automation, run the workflow [bootstrap-oidc.yml](../.github/workflows/bootstrap-oidc.yml) with `workflow_dispatch`.

Quick run order and input values are documented in [BOOTSTRAP-CHECKLIST.md](./BOOTSTRAP-CHECKLIST.md).

It will:

1. Create the App Registration and service principal
2. Create federated credentials for GitHub usage
3. Assign required subscription roles
4. Populate repo variables (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`)
5. Populate repo secrets (`SSH_PUBLIC_KEY`, `TELEGRAM_BOT_TOKEN`)
6. Optionally generate an SSH keypair and store private key in a repo secret

Prerequisite for this bootstrap workflow:

1. Create a bootstrap OIDC app/service principal in Entra ID with repo federated credentials and assign subscription roles (`Contributor`, `User Access Administrator`)
2. Set repository variables `BOOTSTRAP_AZURE_CLIENT_ID`, `BOOTSTRAP_AZURE_TENANT_ID`, and `BOOTSTRAP_AZURE_SUBSCRIPTION_ID`

SSH key automation options:

1. Fully automatic: set `generate_ssh_key=true` and leave `ssh_public_key` empty.
2. Manual key: set `ssh_public_key` and optionally set `generate_ssh_key=false`.
3. If generated, private key is saved in repo secret `OPENCLAW_SSH_PRIVATE_KEY` (or your custom `ssh_private_key_secret_name`).
4. Recommended access model: use Azure AD SSH as primary access path; generated key-based access is a fallback/recovery option.

Security note:

1. The bootstrap workflow uses GitHub OIDC (no bootstrap client secret).
2. Treat `ssh_public_key` and `telegram_bot_token` workflow inputs as sensitive values and only run this workflow in trusted repositories.

If you do not want workflow-based bootstrap, use the manual CLI method below instead.

### Create an App Registration

```bash
# Create the App Registration
az ad app create --display-name "openclaw-azure-foundry-cicd"

# Note the appId from the output
APP_ID="<appId from output>"

# Create a service principal for the app
az ad sp create --id "$APP_ID"

# Get the service principal object ID
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)
```

### Add Federated Credentials

Add two federated credentials — one for the `main` branch (deployments) and one for pull requests (validation):

```bash
GITHUB_ORG="YOUR_GITHUB_ORG_OR_USERNAME"
GITHUB_REPO="openclaw-azure-foundry"

# Federated credential for main branch pushes
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"github-main\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/main\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"

# Federated credential for pull requests
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"github-pr\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${GITHUB_ORG}/${GITHUB_REPO}:pull_request\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"
```

### Assign Azure Roles

The service principal needs **Contributor** (to deploy resources) and **User Access Administrator** (to assign the Key Vault Secrets User role to the VM's managed identity):

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

az role assignment create \
  --assignee "$SP_OBJECT_ID" \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID"

az role assignment create \
  --assignee "$SP_OBJECT_ID" \
  --role "User Access Administrator" \
  --scope "/subscriptions/$SUBSCRIPTION_ID"
```

---

## 2. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Follow the prompts — choose a name (e.g. `OpenClaw Assistant`) and a username (e.g. `my_openclaw_bot`)
4. BotFather will reply with a token like `123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ`
5. Save this token — you'll need it as `TELEGRAM_BOT_TOKEN`

---

## 3. Set GitHub Secrets & Variables

In your GitHub repository, go to **Settings → Secrets and variables → Actions**.

### Secrets

| Name | Value |
|------|-------|
| `SSH_PUBLIC_KEY` | Contents of `~/.ssh/id_ed25519.pub` (run `cat ~/.ssh/id_ed25519.pub`) |
| `TELEGRAM_BOT_TOKEN` | Token from BotFather |

### Variables

| Name | Value |
|------|-------|
| `AZURE_CLIENT_ID` | `$APP_ID` from step 1 |
| `AZURE_TENANT_ID` | Run `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | Run `az account show --query id -o tsv` |

### Create the `prod` Environment

Go to **Settings → Environments → New environment**, name it `prod`, and optionally add required reviewers for deployment gate protection.

---

## 4. Deploy Manually with Bicep

If you prefer to deploy without GitHub Actions:

```bash
az deployment sub create \
  --location eastus2 \
  --template-file infrastructure/main.bicep \
  --parameters infrastructure/parameters/prod.bicepparam \
  --parameters sshPublicKey="$(cat ~/.ssh/id_ed25519.pub)" \
  --parameters telegramBotToken="YOUR_BOT_TOKEN"
```

For a dry-run (what-if) first:

```bash
az deployment sub what-if \
  --location eastus2 \
  --template-file infrastructure/main.bicep \
  --parameters infrastructure/parameters/prod.bicepparam \
  --parameters sshPublicKey="$(cat ~/.ssh/id_ed25519.pub)" \
  --parameters telegramBotToken="YOUR_BOT_TOKEN"
```

---

## 5. Connecting to the VM

The VM has no public IP. Use Azure AD SSH:

```bash
# Install the SSH extension (one-time setup)
az extension add -n ssh

# Connect using the helper script
./scripts/connect.sh

# Or directly:
az ssh vm --resource-group rg-openclaw --name vm-openclaw
```

> Your Azure AD account needs the `Virtual Machine User Login` or `Virtual Machine Administrator Login` role on the VM or its resource group.

---

## 6. Verifying the Deployment

Run the validation script to check cloud-init completion, the OpenClaw service, and DNS resolution:

```bash
./scripts/validate-deployment.sh
```

You can also check cloud-init logs directly on the VM:

```bash
# After SSH-ing in:
cat /var/log/cloud-init-output.log
sudo systemctl status openclaw
sudo -u openclaw openclaw status
```

---

## 7. Sending the First Telegram Message

1. Open Telegram and find your bot (search for its username)
2. Send `/start` to initiate the pairing flow
3. Follow the pairing instructions — OpenClaw will respond once the bot token is verified
4. Start chatting! Try: `hello, are you there?`

> **Tip:** The first message may take a few seconds as OpenClaw establishes the session. If there's no response after 30 seconds, check `systemctl status openclaw` on the VM.
