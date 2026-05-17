param location string
param vnetName string

// NSG for VM subnet
resource nsg 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: 'nsg-vm-openclaw'
  location: location
  properties: {
    securityRules: [
      // ── Inbound ──────────────────────────────────────────────────────────────
      {
        name: 'DenyAllInboundFromInternet'
        properties: {
          priority: 100
          protocol: '*'
          access: 'Deny'
          direction: 'Inbound'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
      {
        name: 'AllowVnetInbound'
        properties: {
          priority: 200
          protocol: '*'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '*'
        }
      }

      // ── Outbound — explicit allows before catch-all deny ──────────────────────
      {
        // Required for managed-identity token acquisition and az login --identity
        name: 'AllowAADOutbound'
        properties: {
          priority: 1000
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Outbound'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'AzureActiveDirectory'
          destinationPortRange: '443'
        }
      }
      {
        // Required for az keyvault secret show (Key Vault private endpoint resolves
        // to a VNet IP, but the service tag covers the control plane too)
        name: 'AllowKeyVaultOutbound'
        properties: {
          priority: 1010
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Outbound'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'AzureKeyVault'
          destinationPortRange: '443'
        }
      }
      {
        // Required for Azure AI / Cognitive Services API calls
        name: 'AllowCognitiveServicesOutbound'
        properties: {
          priority: 1020
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Outbound'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'CognitiveServicesManagement'
          destinationPortRange: '443'
        }
      }
      {
        // Required for Azure Monitor / diagnostics
        name: 'AllowAzureMonitorOutbound'
        properties: {
          priority: 1030
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Outbound'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'AzureMonitor'
          destinationPortRange: '443'
        }
      }
      {
        // Required for VNet-internal traffic (private endpoints for KV / AI Services)
        name: 'AllowVnetOutbound'
        properties: {
          priority: 1040
          protocol: '*'
          access: 'Allow'
          direction: 'Outbound'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '*'
        }
      }
      {
        // Required for cloud-init: apt package downloads, Node.js / Azure CLI repos,
        // and the Telegram Bot API (api.telegram.org). HTTP (80) is needed for apt
        // metadata and certificate-revocation checks.
        name: 'AllowHttpsInternetOutbound'
        properties: {
          priority: 1050
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Outbound'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'Internet'
          destinationPortRange: '443'
        }
      }
      {
        name: 'AllowHttpInternetOutbound'
        properties: {
          priority: 1060
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Outbound'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'Internet'
          destinationPortRange: '80'
        }
      }
      {
        // Required for DNS resolution (Azure DNS is 168.63.129.16)
        name: 'AllowDnsOutbound'
        properties: {
          priority: 1070
          protocol: 'Udp'
          access: 'Allow'
          direction: 'Outbound'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'AzureDNS'
          destinationPortRange: '53'
        }
      }
      {
        // Block all other outbound traffic not matched by the rules above
        name: 'DenyAllOutbound'
        properties: {
          priority: 4000
          protocol: '*'
          access: 'Deny'
          direction: 'Outbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

// Virtual Network
resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.40.0.0/16']
    }
    subnets: [
      {
        name: 'snet-vm'
        properties: {
          addressPrefix: '10.40.2.0/24'
          networkSecurityGroup: {
            id: nsg.id
          }
          privateEndpointNetworkPolicies: 'Enabled'
        }
      }
      {
        name: 'snet-pe'
        properties: {
          addressPrefix: '10.40.3.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

// Private DNS Zone for Azure OpenAI (cognitiveservices PE sub-resource)
resource openaiDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.openai.azure.com'
  location: 'global'
}

// Private DNS Zone for AI Services (services.ai.azure.com endpoint)
resource aiServicesDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.services.ai.azure.com'
  location: 'global'
}

// Private DNS Zone for Key Vault
resource kvDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
}

// VNet link for OpenAI DNS zone
resource openaiDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: openaiDnsZone
  name: 'link-openai-${vnetName}'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

// VNet link for AI Services DNS zone
resource aiServicesDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: aiServicesDnsZone
  name: 'link-aiservices-${vnetName}'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

// VNet link for Key Vault DNS zone
resource kvDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: kvDnsZone
  name: 'link-kv-${vnetName}'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

output vnetId string = vnet.id
output vmSubnetId string = vnet.properties.subnets[0].id
output peSubnetId string = vnet.properties.subnets[1].id
output openaiPrivateDnsZoneId string = openaiDnsZone.id
output aiServicesDnsZoneId string = aiServicesDnsZone.id
output kvPrivateDnsZoneId string = kvDnsZone.id
