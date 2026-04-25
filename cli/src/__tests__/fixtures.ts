import type { CliConfig } from "../types.js";

export function validConfig(overrides?: Partial<CliConfig>): CliConfig {
  return {
    suffix: "test",
    location: "eastus2",
    resourceGroupName: "rg-test",
    vnetName: "vnet-test",
    vmName: "vm-test",
    vmSize: "Standard_D2s_v3",
    osDiskSizeGb: 64,
    adminUsername: "openclaw",
    sshPublicKeyPath: "~/.ssh/id_ed25519.pub",
    aiServicesName: "oc-ai-test-abc123",
    hubName: "hub-test",
    projectName: "proj-test",
    storageAccountName: "sttest123abc",
    modelName: "gpt-4o",
    modelVersion: "2024-11-20",
    modelCapacity: 30,
    keyVaultName: "kv-test-abc123",
    ...overrides,
  };
}
