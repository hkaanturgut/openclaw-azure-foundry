using '../main.bicep'

param location = 'eastus2'
param resourceGroupName = 'rg-openclaw-ntug'
param vnetName = 'vnet-openclaw-ntug'
param vmName = 'vm-openclaw-ntug'
param vmSize = 'Standard_D2s_v3'
param osDiskSizeGb = 64
param adminUsername = 'openclaw'
param aiServicesName = 'oc-ai-services-demontug'
param hubName = 'oc-foundry-hub-demontug'
param projectName = 'oc-foundry-proj-demontug'
param storageAccountName = 'stocfoundrydemontug'
param modelName = 'gpt-4o'
param modelVersion = '2024-11-20'
param modelCapacity = 20
param keyVaultName = 'kv-oc-demo-ntug'
// sshPublicKey and telegramBotToken passed at deploy time
param sshPublicKey = 'ssh-rsa PLACEHOLDER'
param telegramBotToken = 'PLACEHOLDER'
