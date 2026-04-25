param location string
param aiServicesName string
param hubName string
param projectName string
param storageAccountName string
param modelName string = 'gpt-4o'
param modelVersion string = '2024-11-20'
param modelCapacity int = 30

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

// Model deployment on AI Services
resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = if (!empty(modelName)) {
  parent: aiServices
  name: !empty(modelName) ? modelName : 'placeholder'
  sku: {
    name: 'Standard'
    capacity: modelCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: modelName
      version: modelVersion
    }
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

// Connect AI Services to the Hub
resource aiServicesConnection 'Microsoft.MachineLearningServices/workspaces/connections@2024-07-01-preview' = {
  parent: hub
  name: 'ai-services-connection'
  properties: {
    category: 'AIServices'
    target: aiServices.properties.endpoint
    authType: 'ApiKey'
    isSharedToAll: true
    credentials: {
      key: aiServices.listKeys().key1
    }
    metadata: {
      ApiType: 'Azure'
      ResourceId: aiServices.id
    }
  }
}

// Azure AI Foundry Project (child of Hub)
resource project 'Microsoft.MachineLearningServices/workspaces@2024-07-01-preview' = {
  name: projectName
  location: location
  kind: 'Project'
  identity: { type: 'SystemAssigned' }
  properties: {
    hubResourceId: hub.id
    publicNetworkAccess: 'Disabled'
    friendlyName: projectName
  }
}

output aiServicesId string = aiServices.id
output hubId string = hub.id
output projectId string = project.id
output storageAccountId string = storageAccount.id
output aiServicesEndpoint string = aiServices.properties.endpoint

@secure()
output foundryApiKey string = aiServices.listKeys().key1
