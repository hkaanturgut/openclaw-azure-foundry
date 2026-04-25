import fs from "node:fs/promises";
import path from "node:path";
import type { CliConfig } from "./types.js";
import { getStateDir } from "./utils.js";

export function generatedParamsPath(): string {
  return path.join(getStateDir(), "generated.parameters.json");
}

export function renderParams(config: CliConfig): string {
  const params: Record<string, { value: string | number }> = {
    location: { value: config.location },
    resourceGroupName: { value: config.resourceGroupName },
    vnetName: { value: config.vnetName },
    vmName: { value: config.vmName },
    vmSize: { value: config.vmSize },
    osDiskSizeGb: { value: config.osDiskSizeGb },
    adminUsername: { value: config.adminUsername },
    aiServicesName: { value: config.aiServicesName },
    hubName: { value: config.hubName },
    projectName: { value: config.projectName },
    storageAccountName: { value: config.storageAccountName },
    modelName: { value: config.modelName },
    modelVersion: { value: config.modelVersion },
    modelCapacity: { value: config.modelCapacity },
    keyVaultName: { value: config.keyVaultName },
  };

  return JSON.stringify({
    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    contentVersion: "1.0.0.0",
    parameters: params,
  }, null, 2);
}

export async function writeGeneratedParams(config: CliConfig): Promise<string> {
  const outputPath = generatedParamsPath();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, renderParams(config), "utf8");
  return outputPath;
}
