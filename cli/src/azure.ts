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
    "--scripts", "sudo -u openclaw /home/openclaw/.npm-global/bin/openclaw status",
  ]);

  console.log("\n=== Checking Private Endpoint DNS resolution ===");
  await runCommand("az", [
    "vm", "run-command", "invoke", "-g", rg, "-n", vm,
    "--command-id", "RunShellScript",
    "--scripts", `nslookup ${config.aiServicesName}.services.ai.azure.com`,
  ]);
}

export async function approvePairing(rgName: string, vmName: string, pairingCode: string): Promise<void> {
  console.log(`Approving pairing code: ${pairingCode}`);
  const code = await runCommand("az", [
    "vm", "run-command", "invoke",
    "--resource-group", rgName,
    "--name", vmName,
    "--command-id", "RunShellScript",
    "--scripts", `sudo -u openclaw /home/openclaw/.npm-global/bin/openclaw pairing approve telegram ${pairingCode} 2>&1`,
  ]);
  if (code !== 0) {
    throw new Error("Pairing approval failed.");
  }
}

export async function destroyResources(rgName: string): Promise<void> {
  console.log(`\nDeleting resource group: ${rgName} ...`);
  const deleteCode = await runCommand("az", [
    "group", "delete", "-n", rgName, "--yes",
  ]);
  if (deleteCode !== 0) {
    throw new Error(`Failed to delete resource group ${rgName}.`);
  }
  console.log(`✅ Resource group ${rgName} deleted.\n`);

  // Purge soft-deleted Cognitive Services that belonged to this RG to free model quota
  console.log("Checking for soft-deleted AI Services to purge ...");
  const result = await new Promise<string>((resolve) => {
    import("node:child_process").then(({ execSync }) => {
      try {
        const out = execSync(
          `az cognitiveservices account list-deleted --query "[?contains(id, '${rgName}')].[name, location]" -o json`,
          { encoding: "utf-8" }
        );
        resolve(out);
      } catch { resolve("[]"); }
    });
  });
  const items = JSON.parse(result) as string[][];
  for (const [name, location] of items) {
    console.log(`  Purging: ${name} (${location}) ...`);
    await runCommand("az", [
      "cognitiveservices", "account", "purge",
      "--name", name, "--resource-group", rgName, "--location", location,
    ]);
  }
  if (items.length > 0) {
    console.log(`✅ Purged ${items.length} soft-deleted AI Services — model quota freed.`);
  } else {
    console.log("  No soft-deleted AI Services found for this resource group.");
  }

  console.log("\n🧹 Destroy complete.");
}
