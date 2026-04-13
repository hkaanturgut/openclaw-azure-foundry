#!/bin/bash
# Post-deployment validation
set -e
RG="${1:-rg-openclaw}"
VM="${2:-vm-openclaw}"

AI_SERVICES_NAME=$(az resource list -g "$RG" --resource-type Microsoft.CognitiveServices/accounts --query "[?kind=='AIServices'].name | [0]" -o tsv)
if [ -z "$AI_SERVICES_NAME" ]; then
  echo "Could not determine AI Services account name in $RG"
  exit 1
fi

echo "=== Checking cloud-init status ==="
az vm run-command invoke -g "$RG" -n "$VM" --command-id RunShellScript \
  --scripts "cloud-init status"

echo "=== Checking OpenClaw service ==="
az vm run-command invoke -g "$RG" -n "$VM" --command-id RunShellScript \
  --scripts "systemctl status openclaw"

echo "=== Checking OpenClaw status ==="
az vm run-command invoke -g "$RG" -n "$VM" --command-id RunShellScript \
  --scripts "sudo -u openclaw openclaw status"

echo "=== Checking Private Endpoint DNS resolution ==="
az vm run-command invoke -g "$RG" -n "$VM" --command-id RunShellScript \
  --scripts "nslookup ${AI_SERVICES_NAME}.services.ai.azure.com"
