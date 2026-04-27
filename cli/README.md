# openclaw-azure-cli

Deploy [OpenClaw](https://openclaw.ai) on Azure AI Foundry with a single CLI — no repo clone needed.

> This file is the npm package README source and is kept in sync with the root repo README by `.github/workflows/release-readme-agent.yml`.

[![npm version](https://img.shields.io/npm/v/openclaw-azure-cli)](https://www.npmjs.com/package/openclaw-azure-cli)

## Quick start

```bash
npm install -g openclaw-azure-cli@beta
openclaw-azure init
openclaw-azure deploy
```

## Prerequisites

- [Node.js](https://nodejs.org) LTS
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) with Bicep (`az bicep install`)
- An Azure subscription
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Commands

| Command | Description |
|---------|-------------|
| `openclaw-azure init` | Interactive config collection (suffix, location, VM, model settings) |
| `openclaw-azure deploy` | Preflight checks, Azure login, infrastructure provisioning, and validation |
| `openclaw-azure pair` | Approve a Telegram pairing code on a running deployment |
| `openclaw-azure destroy` | Delete all deployed resources and purge soft-deleted items |
| `openclaw-azure help` | Show usage information |

## What gets deployed

- **AI Foundry** — Hub + Project with GPT-4o model deployment
- **Virtual Machine** — Ubuntu 24.04 LTS running OpenClaw via systemd
- **Key Vault** — Stores Foundry API key and Telegram bot token (RBAC-secured)
- **Networking** — Private VNet, NAT Gateway (outbound-only), NSG, private endpoints
- **Private DNS Zones** — For AI Services, OpenAI, and Key Vault

All services use private endpoints with no public inbound access.

## Architecture

```
VNet 10.40.0.0/16
├─ snet-vm  10.40.2.0/24  (VM + NAT Gateway, no public IP)
└─ snet-pe  10.40.3.0/24  (Private endpoints)

Private DNS Zones:
├─ privatelink.openai.azure.com
├─ privatelink.services.ai.azure.com
└─ privatelink.vaultcore.azure.net
```

## Local development

```bash
cd cli
npm install
npm run build
npm link              # symlink globally for testing
openclaw-azure help
```

## Configuration

All state is stored locally in `.openclaw-azure/`:

```
.openclaw-azure/
├─ config.json                  # CLI configuration
├─ generated.parameters.json    # Bicep deployment parameters
└─ ssh/
   ├─ id_ed25519                # Private key
   └─ id_ed25519.pub            # Public key
```

## Notes

- Uses direct Azure auth (`az login`) with subscription selection.
- Telegram bot token is prompted at deploy time and stored in Key Vault (not persisted locally).
- SSH keypair can be auto-generated or you can provide your own.
- The bonjour plugin is disabled automatically (mDNS doesn't work on headless cloud VMs).
