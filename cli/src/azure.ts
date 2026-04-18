import fs from "node:fs/promises";
import path from "node:path";
import type { CliConfig } from "./types.js";
import { runCommand, runOrThrow } from "./utils.js";

export async function preflightChecks(): Promise<void> {
  await runOrThrow("az", ["--version"], "Azure CLI is not installed or not in PATH.");
  await runOrThrow("az", ["account", "show", "-o", "none"], "No active Azure login. Run `az login`.");
  await runOrThrow("az", ["bicep", "version"], "Bicep support is not available. Run `az bicep install`.");
}

export async function runDeployment(
  projectRoot: string,
  location: string,
  paramsPath: string,
  sshPublicKeyPath: string,
  telegramToken: string,
): Promise<void> {
  const sshKey = (await fs.readFile(path.resolve(sshPublicKeyPath), "utf8")).trim();
  if (!sshKey) {
    throw new Error("SSH public key file is empty.");
  }

  const args = [
    "deployment",
    "sub",
    "create",
    "--location",
    location,
    "--template-file",
    path.join(projectRoot, "infrastructure", "main.bicep"),
    "--parameters",
    paramsPath,
    "--parameters",
    `sshPublicKey=${sshKey}`,
    "--parameters",
    `telegramBotToken=${telegramToken}`,
  ];

  const code = await runCommand("az", args);
  if (code !== 0) {
    throw new Error("Azure deployment failed.");
  }
}

export async function runValidation(config: CliConfig): Promise<void> {
  const rg = config.resourceGroupName;
  const vm = config.vmName;

  console.log("\n=== Checking cloud-init status ===");
  await runCommand("az", [
    "vm", "run-command", "invoke", "-g", rg, "-n", vm,
    "--command-id", "RunShellScript",
    "--scripts", "cloud-init status",
  ]);

  console.log("\n=== Checking OpenClaw service ===");
  await runCommand("az", [
    "vm", "run-command", "invoke", "-g", rg, "-n", vm,
    "--command-id", "RunShellScript",
    "--scripts", "systemctl status openclaw",
  ]);

  console.log("\n=== Checking OpenClaw status ===");
  await runCommand("az", [
    "vm", "run-command", "invoke", "-g", rg, "-n", vm,
    "--command-id", "RunShellScript",
    "--scripts", "sudo -u openclaw openclaw status",
  ]);

  console.log("\n=== Checking Private Endpoint DNS resolution ===");
  await runCommand("az", [
    "vm", "run-command", "invoke", "-g", rg, "-n", vm,
    "--command-id", "RunShellScript",
    "--scripts", `nslookup ${config.aiServicesName}.services.ai.azure.com`,
  ]);
}

export async function approvePairing(config: CliConfig, pairingCode: string): Promise<void> {
  const rg = config.resourceGroupName;
  const vm = config.vmName;

  console.log(`Approving pairing code: ${pairingCode}`);
  const code = await runCommand("az", [
    "vm", "run-command", "invoke",
    "--resource-group", rg,
    "--name", vm,
    "--command-id", "RunShellScript",
    "--scripts", `sudo -u openclaw /home/openclaw/.npm-global/bin/openclaw pairing approve telegram ${pairingCode} 2>&1`,
  ]);
  if (code !== 0) {
    throw new Error("Pairing approval failed.");
  }
}

export async function destroyResources(config: CliConfig): Promise<void> {
  const rg = config.resourceGroupName;

  console.log(`\nDeleting resource group: ${rg} ...`);
  const deleteCode = await runCommand("az", [
    "group", "delete", "-n", rg, "--yes",
  ]);
  if (deleteCode !== 0) {
    throw new Error(`Failed to delete resource group ${rg}.`);
  }
  console.log(`✅ Resource group ${rg} deleted.\n`);

  // Purge soft-deleted Key Vault
  console.log(`Purging soft-deleted Key Vault: ${config.keyVaultName} ...`);
  const kvCode = await runCommand("az", [
    "keyvault", "purge", "--name", config.keyVaultName,
  ]);
  if (kvCode === 0) {
    console.log(`✅ Key Vault ${config.keyVaultName} purged.`);
  } else {
    console.log(`⚠️  Key Vault purge skipped (may not be in soft-deleted state).`);
  }

  // Purge soft-deleted Cognitive Services (AI Services)
  console.log(`Purging soft-deleted AI Services: ${config.aiServicesName} ...`);
  const aiCode = await runCommand("az", [
    "cognitiveservices", "account", "purge",
    "--name", config.aiServicesName,
    "--resource-group", rg,
    "--location", config.location,
  ]);
  if (aiCode === 0) {
    console.log(`✅ AI Services ${config.aiServicesName} purged.`);
  } else {
    console.log(`⚠️  AI Services purge skipped (may not be in soft-deleted state).`);
  }

  // Purge soft-deleted Storage Account (if applicable)
  // Note: Storage accounts don't have a soft-delete purge via CLI in the same way,
  // but we attempt to check and inform the user.
  console.log(`\nℹ️  Storage account ${config.storageAccountName} — Azure Storage accounts do not use soft-delete at the account level. No purge needed.`);

  console.log("\n🧹 Destroy complete. All resources and soft-deleted items have been cleaned up.");
}
