param location string
param vmName string
param vmSize string = 'Standard_B2as_v2'
param osDiskSizeGb int = 64
param adminUsername string = 'openclaw'

@secure()
param sshPublicKey string

param vmSubnetId string
param keyVaultName string
param aiFoundryAccountName string

var cloudInitRaw = loadTextContent('../cloud-init/cloud-init.yaml')
var cloudInitConfigured = replace(replace(replace(cloudInitRaw,
  '\${KEY_VAULT_NAME}', keyVaultName),
  '\${AI_FOUNDRY_ACCOUNT_NAME}', aiFoundryAccountName),
  '\${ADMIN_USERNAME}', adminUsername)

// Network Interface (no public IP — VM is private)
resource nic 'Microsoft.Network/networkInterfaces@2023-09-01' = {
  name: 'nic-${vmName}'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          subnet: {
            id: vmSubnetId
          }
          privateIPAllocationMethod: 'Dynamic'
        }
      }
    ]
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2023-09-01' = {
  name: vmName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUsername}/.ssh/authorized_keys'
              keyData: sshPublicKey
            }
          ]
        }
      }
      customData: base64(cloudInitConfigured)
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: 'ubuntu-24_04-lts'
        sku: 'server'
        version: 'latest'
      }
      osDisk: {
        createOption: 'FromImage'
        diskSizeGB: osDiskSizeGb
        managedDisk: {
          storageAccountType: 'StandardSSD_LRS'
        }
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
        }
      ]
    }
  }
}

output vmPrincipalId string = vm.identity.principalId
output vmId string = vm.id
