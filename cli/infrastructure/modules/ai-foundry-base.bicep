param location string
param aiServicesName string
param hubName string
param storageAccountName string

// Storage account required by AI Foundry Hub
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// AI Services account (backs the Foundry Hub with OpenAI models)
resource aiServices 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: aiServicesName
  location: location
  kind: 'AIServices'
  sku: { name: 'S0' }
  properties: {
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny' }
    customSubDomainName: aiServicesName
  }
}

// Azure AI Foundry Hub
resource hub 'Microsoft.MachineLearningServices/workspaces@2024-07-01-preview' = {
  name: hubName
  location: location
  kind: 'Hub'
  identity: { type: 'SystemAssigned' }
  properties: {
    storageAccount: storageAccount.id
    publicNetworkAccess: 'Disabled'
    friendlyName: hubName
  }
}

output aiServicesId string = aiServices.id
output hubId string = hub.id
output storageAccountId string = storageAccount.id
output aiServicesEndpoint string = aiServices.properties.endpoint

@secure()
output foundryApiKey string = aiServices.listKeys().key1
