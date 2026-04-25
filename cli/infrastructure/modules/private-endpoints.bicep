param location string
param peSubnetId string
param aiServicesId string
param hubId string
param keyVaultId string
param openaiPrivateDnsZoneId string
param aiServicesDnsZoneId string
param kvPrivateDnsZoneId string

// Private Endpoint for AI Services (account sub-resource)
resource aiServicesPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: 'pe-aiservices-openclaw'
  location: location
  properties: {
    subnet: { id: peSubnetId }
    privateLinkServiceConnections: [
      {
        name: 'plsc-aiservices'
        properties: {
          privateLinkServiceId: aiServicesId
          groupIds: ['account']
        }
      }
    ]
  }
}

resource aiServicesDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {
  parent: aiServicesPrivateEndpoint
  name: 'aiservices-dns-zone-group'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink-openai-azure-com'
        properties: { privateDnsZoneId: openaiPrivateDnsZoneId }
      }
      {
        name: 'privatelink-services-ai-azure-com'
        properties: { privateDnsZoneId: aiServicesDnsZoneId }
      }
    ]
  }
}

// Private Endpoint for AI Foundry Hub (amlworkspace sub-resource)
resource hubPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: 'pe-hub-openclaw'
  location: location
  properties: {
    subnet: { id: peSubnetId }
    privateLinkServiceConnections: [
      {
        name: 'plsc-hub'
        properties: {
          privateLinkServiceId: hubId
          groupIds: ['amlworkspace']
        }
      }
    ]
  }
}

// Private Endpoint for Key Vault
resource kvPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: 'pe-kv-openclaw'
  location: location
  properties: {
    subnet: { id: peSubnetId }
    privateLinkServiceConnections: [
      {
        name: 'plsc-kv'
        properties: {
          privateLinkServiceId: keyVaultId
          groupIds: ['vault']
        }
      }
    ]
  }
}

resource kvDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {
  parent: kvPrivateEndpoint
  name: 'kv-dns-zone-group'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink-vaultcore-azure-net'
        properties: { privateDnsZoneId: kvPrivateDnsZoneId }
      }
    ]
  }
}

output aiServicesPrivateEndpointId string = aiServicesPrivateEndpoint.id
output hubPrivateEndpointId string = hubPrivateEndpoint.id
output kvPrivateEndpointId string = kvPrivateEndpoint.id
