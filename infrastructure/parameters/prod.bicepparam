using '../main.bicep'

param location = 'eastus2'
param resourceGroupName = 'rg-openclaw-gabt'
param vnetName = 'vnet-openclaw-gabt'
param vmName = 'vm-openclaw-gabt'
param vmSize = 'Standard_D2s_v3'
param osDiskSizeGb = 64
param adminUsername = 'openclaw'
param aiServicesName = 'oc-ai-services-demogabt'
param hubName = 'oc-foundry-hub-demogabt'
param projectName = 'oc-foundry-proj-demogabt'
param storageAccountName = 'stocfoundrydemogabt'
param modelName = 'gpt-4o'
param modelVersion = '2024-11-20'
param modelCapacity = 20
param keyVaultName = 'kv-oc-demo-gabt'
// sshPublicKey and telegramBotToken passed at deploy time
param sshPublicKey = 'ssh-rsa PLACEHOLDER'
param telegramBotToken = 'PLACEHOLDER'
