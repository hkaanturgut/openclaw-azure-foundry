using '../main.bicep'

param location = 'eastus2'
param resourceGroupName = 'rg-openclaw-02'
param vnetName = 'vnet-openclaw-02'
param vmName = 'vm-openclaw-02'
param vmSize = 'Standard_D2s_v3'
param osDiskSizeGb = 64
param adminUsername = 'openclaw'
param aiServicesName = 'oc-ai-services-demo02'
param hubName = 'oc-foundry-hub-demo02'
param projectName = 'oc-foundry-proj-demo02'
param storageAccountName = 'stocfoundrydemo0102'
param modelName = 'gpt-4o'
param modelVersion = '2024-11-20'
param modelCapacity = 20
param keyVaultName = 'kv-oc-demo-0102'
// sshPublicKey and telegramBotToken passed at deploy time
param sshPublicKey = 'ssh-rsa PLACEHOLDER'
param telegramBotToken = 'PLACEHOLDER'
