#!/bin/bash
# OIDC setup commands for hkaanturgut/openclaw-azure-foundry
# Run as a user with permissions to create App Registrations and assign roles
# Optional env vars:
#   TARGET_TENANT_ID      Tenant ID to enforce before setup
#   TARGET_SUBSCRIPTION_ID Subscription ID to enforce before role assignments

set -euo pipefail
OWNER="${OWNER:-hkaanturgut}"
REPO="${REPO:-openclaw-azure-foundry}"
APP_NAME="${APP_NAME:-openclaw-github-actions}"

echo "Validating Azure login context..."
az account show -o none

targetTenantId="${TARGET_TENANT_ID:-}"
targetSubscriptionId="${TARGET_SUBSCRIPTION_ID:-}"

currentTenantId=$(az account show --query tenantId -o tsv)
currentSubscriptionId=$(az account show --query id -o tsv)

if [ -n "$targetTenantId" ] && [ "$currentTenantId" != "$targetTenantId" ]; then
  echo "Switching Azure context to target tenant: $targetTenantId"
  az login --tenant "$targetTenantId" -o none
  currentTenantId=$(az account show --query tenantId -o tsv)
  if [ "$currentTenantId" != "$targetTenantId" ]; then
    echo "ERROR: Active tenant ($currentTenantId) does not match TARGET_TENANT_ID ($targetTenantId)." >&2
    exit 1
  fi
fi

if [ -n "$targetSubscriptionId" ] && [ "$currentSubscriptionId" != "$targetSubscriptionId" ]; then
  echo "Switching Azure context to target subscription: $targetSubscriptionId"
  az account set --subscription "$targetSubscriptionId"
  currentSubscriptionId=$(az account show --query id -o tsv)
  if [ "$currentSubscriptionId" != "$targetSubscriptionId" ]; then
    echo "ERROR: Active subscription ($currentSubscriptionId) does not match TARGET_SUBSCRIPTION_ID ($targetSubscriptionId)." >&2
    exit 1
  fi
fi

echo "Using tenant: $(az account show --query tenantId -o tsv)"
echo "Using subscription: $(az account show --query id -o tsv)"

# 1) Create the App Registration
appId=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
echo "Created appId: $appId"

# 2) Create Service Principal
az ad sp create --id "$appId"
spObjectId=$(az ad sp show --id "$appId" --query id -o tsv)

# 3) Add federated credential for main branch
az ad app federated-credential create --id "$appId" --parameters '{
  "name":"github-actions-main",
  "issuer":"https://token.actions.githubusercontent.com",
  "subject":"repo:'$OWNER'/'$REPO':ref:refs/heads/main",
  "audiences":["api://AzureADTokenExchange"]
}'

# 4) Add federated credential for pull_request validation workflow
az ad app federated-credential create --id "$appId" --parameters '{
  "name":"github-actions-pr",
  "issuer":"https://token.actions.githubusercontent.com",
  "subject":"repo:'$OWNER'/'$REPO':pull_request",
  "audiences":["api://AzureADTokenExchange"]
}'

# 5) Assign roles at subscription scope
subId=$(az account show --query id -o tsv)
tenantId=$(az account show --query tenantId -o tsv)

# Contributor role
az role assignment create --assignee-object-id "$spObjectId" --assignee-principal-type ServicePrincipal --role "Contributor" --scope "/subscriptions/$subId"

# User Access Administrator role
az role assignment create --assignee-object-id "$spObjectId" --assignee-principal-type ServicePrincipal --role "User Access Administrator" --scope "/subscriptions/$subId"

# 6) Print variables to set in GitHub
cat <<EOT
Set these values in GitHub repository Variables (not secrets):
AZURE_CLIENT_ID=$appId
AZURE_TENANT_ID=$tenantId
AZURE_SUBSCRIPTION_ID=$subId
EOT

echo "OIDC setup complete"
