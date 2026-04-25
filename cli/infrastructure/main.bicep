targetScope = 'subscription'

@description('Azure region for all resources')
param location string = 'eastus2'

@description('Resource group name')
param resourceGroupName string = 'rg-openclaw'

@description('Virtual network name')
param vnetName string = 'vnet-openclaw'

@description('Virtual machine name')
param vmName string = 'vm-openclaw'

@description('VM size')
param vmSize string = 'Standard_D2s_v3'

@description('OS disk size in GB')
param osDiskSizeGb int = 64

@description('Admin username for the VM')
param adminUsername string = 'openclaw'

@description('SSH public key for VM access')
@secure()
param sshPublicKey string

@description('AI Services account name (backs Foundry Hub)')
param aiServicesName string = 'oc-ai-services-demo'

@description('AI Foundry Hub name')
param hubName string = 'oc-foundry-hub-demo'

@description('AI Foundry Project name')
param projectName string = 'oc-foundry-project-demo'

@description('Storage account name for Foundry Hub (3-24 chars, lowercase alphanumeric)')
param storageAccountName string = 'stocfoundrydemo01'

@description('Model name to deploy')
param modelName string = 'gpt-4o'

@description('Model version')
param modelVersion string = '2024-11-20'

@description('Model capacity (TPM in thousands)')
param modelCapacity int = 30

@description('Key Vault name')
param keyVaultName string = 'kv-oc-demo-01'

@description('Telegram bot token')
@secure()
param telegramBotToken string

// Create the resource group
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
}

// 1. Networking
module networking 'modules/networking.bicep' = {
  name: 'networking'
  scope: resourceGroup(resourceGroupName)
  params: {
    location: location
    vnetName: vnetName
  }
  dependsOn: [rg]
}

// 2a. AI Foundry Base (AI Services + Hub + Storage)
module aiFoundryBase 'modules/ai-foundry-base.bicep' = {
  name: 'ai-foundry-base'
  scope: resourceGroup(resourceGroupName)
  params: {
    location: location
    aiServicesName: aiServicesName
    hubName: hubName
    storageAccountName: storageAccountName
  }
  dependsOn: [rg]
}

// 2b. AI Foundry Project (model deployment + connection + project)
module aiFoundryProject 'modules/ai-foundry-project.bicep' = {
  name: 'ai-foundry-project'
  scope: resourceGroup(resourceGroupName)
  params: {
    location: location
    aiServicesName: aiServicesName
    hubName: hubName
    projectName: projectName
    modelName: modelName
    modelVersion: modelVersion
    modelCapacity: modelCapacity
  }
  dependsOn: [aiFoundryBase]
}

// 3. Compute (deployed before keyvault to get the principalId)
module compute 'modules/compute.bicep' = {
  name: 'compute'
  scope: resourceGroup(resourceGroupName)
  params: {
    location: location
    vmName: vmName
    vmSize: vmSize
    osDiskSizeGb: osDiskSizeGb
    adminUsername: adminUsername
    sshPublicKey: sshPublicKey
    vmSubnetId: networking.outputs.vmSubnetId
    keyVaultName: keyVaultName
    aiFoundryAccountName: aiServicesName
  }
}

// 4. Key Vault (after compute so we have the VM principal ID)
module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  scope: resourceGroup(resourceGroupName)
  params: {
    location: location
    keyVaultName: keyVaultName
    foundryApiKey: aiFoundryBase.outputs.foundryApiKey
    telegramBotToken: telegramBotToken
    vmPrincipalId: compute.outputs.vmPrincipalId
  }
}

// 5. Private Endpoints
module privateEndpoints 'modules/private-endpoints.bicep' = {
  name: 'private-endpoints'
  scope: resourceGroup(resourceGroupName)
  params: {
    location: location
    peSubnetId: networking.outputs.peSubnetId
    aiServicesId: aiFoundryBase.outputs.aiServicesId
    hubId: aiFoundryBase.outputs.hubId
    keyVaultId: keyvault.outputs.keyVaultId
    openaiPrivateDnsZoneId: networking.outputs.openaiPrivateDnsZoneId
    aiServicesDnsZoneId: networking.outputs.aiServicesDnsZoneId
    kvPrivateDnsZoneId: networking.outputs.kvPrivateDnsZoneId
  }
}

output resourceGroupName string = resourceGroupName
output vmName string = vmName
output keyVaultName string = keyvault.outputs.keyVaultName
output aiServicesEndpoint string = aiFoundryBase.outputs.aiServicesEndpoint
output hubId string = aiFoundryBase.outputs.hubId
output projectId string = aiFoundryProject.outputs.projectId
