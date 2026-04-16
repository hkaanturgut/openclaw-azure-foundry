using '../main.bicep'

param location = 'eastus2'
param resourceGroupName = 'rg-openclaw-dev'
param vnetName = 'vnet-openclaw-dev'
param vmName = 'vm-openclaw-dev'
param vmSize = 'Standard_B2as_v2'
param osDiskSizeGb = 64
param adminUsername = 'openclaw'
param aiServicesName = 'oc-ai-services-dev'
param hubName = 'oc-foundry-hub-dev'
param projectName = 'oc-foundry-proj-dev'
param storageAccountName = 'stocfoundrydev01'
param modelName = 'gpt-4o'
param modelVersion = '2024-11-20'
param modelCapacity = 5
param keyVaultName = 'kv-oc-dev-01'
// sshPublicKey and telegramBotToken passed at deploy time via CLI or GitHub Actions
param sshPublicKey = 'ssh-rsa PLACEHOLDER'
param telegramBotToken = 'PLACEHOLDER'
