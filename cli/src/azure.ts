import fs from "node:fs/promises";
import path from "node:path";
import type { CliConfig } from "./types.js";
import { runCommand, runOrThrow, runCapture, getTemplatePath } from "./utils.js";

export async function preflightChecks(): Promise<void> {
  await runOrThrow("az", ["--version"], "Azure CLI is not installed or not in PATH.");
  await runOrThrow("az", ["bicep", "version"], "Bicep support is not available. Run `az bicep install`.");
}

export async function runDeployment(
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
    getTemplatePath(),
    "--parameters",
    `@${paramsPath}`,
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

const READY_POLL_INTERVAL_SEC = 30;
const READY_POLL_MAX_ATTEMPTS = 20; // 10 minutes total

/** Poll the VM until cloud-init is done and the openclaw service is active. */
export async function waitForReady(config: CliConfig): Promise<void> {
  const rg = config.resourceGroupName;
  const vm = config.vmName;

  console.log("Waiting for OpenClaw to become ready (this can take 5-10 minutes)...\n");

  for (let attempt = 1; attempt <= READY_POLL_MAX_ATTEMPTS; attempt++) {
    const elapsed = (attempt - 1) * READY_POLL_INTERVAL_SEC;
    process.stdout.write(`  [${elapsed}s] Checking cloud-init & service status (attempt ${attempt}/${READY_POLL_MAX_ATTEMPTS})...`);

    const { stdout } = await runCapture("az", [
      "vm", "run-command", "invoke", "-g", rg, "-n", vm,
      "--command-id", "RunShellScript",
      "--scripts", "cloud-init status --long && systemctl is-active openclaw",
      "--query", "value[0].message", "-o", "tsv",
    ]);

    const cloudInitDone = /status:\s*done/i.test(stdout);
    const serviceActive = /\bactive\b/.test(stdout);

    if (cloudInitDone && serviceActive) {
      console.log(" ready ✅");
      return;
    }

    const reason = !cloudInitDone ? "cloud-init still running" : "openclaw service not active";
    console.log(` not ready (${reason})`);

    if (attempt < READY_POLL_MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, READY_POLL_INTERVAL_SEC * 1000));
    }
  }

  throw new Error(
    "OpenClaw did not become ready within the timeout. " +
    "SSH into the VM and check: cloud-init status, journalctl -u openclaw",
  );
}

/** Ensure user is logged in to the correct Azure tenant/subscription. */
export async function ensureAzLogin(): Promise<void> {
  // Check if already logged in
  const { code, stdout } = await runCapture("az", [
    "account", "show", "--query", "{name:name, id:id, tenantId:tenantId}", "-o", "json",
  ]);

  if (code === 0 && stdout) {
    const acct = JSON.parse(stdout) as { name: string; id: string; tenantId: string };
    console.log(`\nCurrently logged in to Azure:`);
    console.log(`  Subscription: ${acct.name} (${acct.id})`);
    console.log(`  Tenant:       ${acct.tenantId}\n`);

    const { askYesNo } = await import("./prompt.js");
    const ok = await askYesNo("Continue with this subscription?", true);
    if (ok) return;

    console.log("Opening browser for Azure login...\n");
  } else {
    console.log("No active Azure login found. Opening browser for login...\n");
  }

  const loginCode = await runCommand("az", ["login"]);
  if (loginCode !== 0) {
    throw new Error("Azure login failed.");
  }

  // Let user pick subscription
  const listCode = await runCommand("az", ["account", "list", "--query", "[].{name:name, id:id, isDefault:isDefault}", "-o", "table"]);
  if (listCode !== 0) {
    throw new Error("Failed to list Azure subscriptions.");
  }

  const { ask } = await import("./prompt.js");
  const subId = await ask("Enter subscription ID to use (leave blank for current default)");
  if (subId) {
    const setCode = await runCommand("az", ["account", "set", "--subscription", subId]);
    if (setCode !== 0) {
      throw new Error(`Failed to set subscription ${subId}.`);
    }
    console.log(`✅ Subscription set to ${subId}`);
  }
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

/** Fetch the existing Telegram bot token from Key Vault via the VM (private endpoint). */
export async function fetchExistingToken(rgName: string, vmName: string, keyVaultName: string): Promise<string> {
  console.log("Fetching existing Telegram token from Key Vault...");
  const { code, stdout } = await runCapture("az", [
    "vm", "run-command", "invoke",
    "--resource-group", rgName,
    "--name", vmName,
    "--command-id", "RunShellScript",
    "--scripts", `az keyvault secret show --vault-name ${keyVaultName} --name telegram-bot-token --query value -o tsv`,
    "--query", "value[0].message", "-o", "tsv",
  ]);
  if (code !== 0) {
    throw new Error("Failed to fetch existing Telegram token from Key Vault.");
  }
  // run-command output contains stdout after [stdout] marker
  const match = /\[stdout\]\s*(.*?)(?:\[stderr\]|$)/s.exec(stdout);
  const token = match ? match[1].trim() : stdout.trim();
  if (!token) {
    throw new Error("Could not retrieve existing Telegram token. Use --rotate-token to provide a new one.");
  }
  return token;
}

/** Update OpenClaw application in-place on the VM. */
export async function updateOpenClawApp(config: CliConfig): Promise<void> {
  const rg = config.resourceGroupName;
  const vm = config.vmName;

  console.log("Updating OpenClaw on the VM...");
  const code = await runCommand("az", [
    "vm", "run-command", "invoke",
    "--resource-group", rg,
    "--name", vm,
    "--command-id", "RunShellScript",
    "--scripts", `sudo -u ${config.adminUsername} bash -c 'OPENCLAW_NONINTERACTIVE=1 curl -fsSL https://openclaw.ai/install.sh | bash' && sudo systemctl restart openclaw`,
  ]);
  if (code !== 0) {
    throw new Error("Failed to update OpenClaw on the VM.");
  }
  console.log("✅ OpenClaw updated. Waiting for service to become ready...\n");
}
