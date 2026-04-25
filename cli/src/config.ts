import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import type { CliConfig } from "./types.js";
import { ask, askNumber, askYesNo } from "./prompt.js";
import { expandTilde, generateSshKeypair, getStateDir } from "./utils.js";
import { validateConfig } from "./validate.js";

export function configPath(): string {
  return path.join(getStateDir(), "config.json");
}

export async function saveConfig(config: CliConfig): Promise<void> {
  await fs.mkdir(getStateDir(), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2), "utf8");
}

export async function loadConfig(): Promise<CliConfig | null> {
  try {
    const raw = await fs.readFile(configPath(), "utf8");
    const config = JSON.parse(raw) as CliConfig;
    validateConfig(config);
    return config;
  } catch {
    return null;
  }
}

export async function collectConfig(): Promise<CliConfig> {
  const defaultSshKey = path.join(os.homedir(), ".ssh", "id_ed25519.pub");

  // Generate a short random hex string for globally unique resources
  const uid = crypto.randomBytes(3).toString("hex"); // 6-char hex

  console.log("\nAll resource names will be derived from a short suffix you provide.");
  console.log("A random ID is appended to globally unique names (storage, key vault, AI services).\n");

  const suffix = await ask("Resource suffix (e.g. your project or env name)", "openclaw");
  const location = await ask("Azure location", "eastus2");

  const generateSsh = await askYesNo("Generate a new SSH keypair for this deployment?", true);
  let sshPublicKeyPath: string;
  if (generateSsh) {
    sshPublicKeyPath = await generateSshKeypair();
  } else {
    sshPublicKeyPath = expandTilde(await ask("SSH public key path", defaultSshKey));
  }

  const useDefaults = await askYesNo("Use default VM settings? (Standard_D2s_v3, 64GB disk)", true);
  const vmSize = useDefaults ? "Standard_D2s_v3" : await ask("VM size", "Standard_D2s_v3");
  const osDiskSizeGb = useDefaults ? 64 : await askNumber("OS disk size GB", 64);

  const modelName = await ask("Model name", "gpt-4o");
  const modelVersion = await ask("Model version", "2024-11-20");
  const modelCapacity = await askNumber("Model capacity (TPM in thousands)", 30);

  // Derive all resource names from suffix + uid
  // Globally unique: storageAccountName, keyVaultName, aiServicesName (include uid)
  // Resource-group scoped: rg, vnet, vm, hub, project (suffix only)
  const config: CliConfig = {
    suffix,
    location,
    resourceGroupName: `rg-${suffix}`,
    vnetName: `vnet-${suffix}`,
    vmName: `vm-${suffix}`,
    vmSize,
    osDiskSizeGb,
    adminUsername: "openclaw",
    sshPublicKeyPath,
    aiServicesName: `oc-ai-${suffix}-${uid}`,
    hubName: `hub-${suffix}`,
    projectName: `proj-${suffix}`,
    storageAccountName: `st${suffix.replace(/[^a-z0-9]/g, "")}${uid}`,
    modelName,
    modelVersion,
    modelCapacity,
    keyVaultName: `kv-${suffix}-${uid}`,
  };

  console.log("\nDerived resource names:");
  console.log(`  Resource Group:   ${config.resourceGroupName}`);
  console.log(`  VNet:             ${config.vnetName}`);
  console.log(`  VM:               ${config.vmName}`);
  console.log(`  AI Services:      ${config.aiServicesName}`);
  console.log(`  Foundry Hub:      ${config.hubName}`);
  console.log(`  Foundry Project:  ${config.projectName}`);
  console.log(`  Storage Account:  ${config.storageAccountName}`);
  console.log(`  Key Vault:        ${config.keyVaultName}`);
  console.log();

  validateConfig(config);
  return config;
}
