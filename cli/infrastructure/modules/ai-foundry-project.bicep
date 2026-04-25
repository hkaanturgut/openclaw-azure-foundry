param location string
param aiServicesName string
param hubName string
param projectName string
param modelName string = 'gpt-4o'
param modelVersion string = '2024-11-20'
param modelCapacity int = 30

// Reference existing AI Services account from base module
resource aiServices 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: aiServicesName
}

// Reference existing Hub from base module
resource hub 'Microsoft.MachineLearningServices/workspaces@2024-07-01-preview' existing = {
  name: hubName
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

// Connect AI Services to the Hub (depends on model deployment)
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
  dependsOn: [modelDeployment]
}

// Azure AI Foundry Project (depends on connection)
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
  dependsOn: [aiServicesConnection]
}

output projectId string = project.id
