#!/usr/bin/env node

import { collectConfig, configPath, loadConfig, saveConfig } from "./config.js";
import { ask, askYesNo } from "./prompt.js";
import { writeGeneratedParams } from "./params.js";
import { findProjectRoot } from "./utils.js";
import { preflightChecks, runDeployment, runValidation, approvePairing, destroyResources } from "./azure.js";

function helpText(): string {
  return `openclaw-azure-cli

Usage:
  openclaw-azure init
  openclaw-azure deploy
  openclaw-azure destroy
  openclaw-azure help

Commands:
  init      Prompt for infrastructure values and save local config.
  deploy    Run Azure preflight checks and deploy infrastructure.
  destroy   Delete all deployed resources and purge soft-deleted items.
`;
}

async function handleInit(projectRoot: string): Promise<void> {
  const config = await collectConfig(projectRoot);
  await saveConfig(projectRoot, config);
  const paramsPath = await writeGeneratedParams(projectRoot, config);
  console.log(`Saved config: ${configPath(projectRoot)}`);
  console.log(`Generated params: ${paramsPath}`);
}

async function handleDeploy(projectRoot: string): Promise<void> {
  const config = await loadConfig(projectRoot);
  if (!config) {
    throw new Error("No valid config found. Run `openclaw-azure init` first.");
  }

  const token = await ask("Telegram bot token (input visible)");
  if (!token) {
    throw new Error("Telegram bot token is required.");
  }

  const paramsPath = await writeGeneratedParams(projectRoot, config);

  console.log("Running preflight checks...");
  await preflightChecks();

  console.log("Deploying infrastructure...");
  await runDeployment(
    projectRoot,
    config.location,
    paramsPath,
    config.sshPublicKeyPath,
    token,
  );

  console.log("\n✅ Deployment completed. Running validation...\n");
  await runValidation(config);

  console.log("\n✅ Validation complete.\n");
  console.log("To pair your Telegram bot:");
  console.log("1. Send any message to your bot on Telegram");
  console.log("2. The bot will respond with a pairing code\n");

  const wantPairing = await askYesNo("Do you have a pairing code to approve now?", true);
  if (wantPairing) {
    const pairingCode = await ask("Enter the pairing code from Telegram");
    if (!pairingCode) {
      throw new Error("Pairing code is required.");
    }
    await approvePairing(config, pairingCode);
    console.log("\n🎉 Pairing approved! Send a message to your bot — you should get a GPT-4o response.");
  } else {
    console.log("\nYou can approve pairing later by running: openclaw-azure deploy");
    console.log("Or manually: az vm run-command invoke -g <RG> -n <VM> --command-id RunShellScript --scripts \"sudo -u openclaw /home/openclaw/.npm-global/bin/openclaw pairing approve telegram <CODE>\"");
  }
}

async function handleDestroy(projectRoot: string): Promise<void> {
  const config = await loadConfig(projectRoot);
  if (!config) {
    throw new Error("No valid config found. Run `openclaw-azure init` first.");
  }

  console.log(`\n⚠️  WARNING: This will permanently delete ALL resources in resource group "${config.resourceGroupName}"`);
  console.log("  and purge soft-deleted Key Vault and AI Services to free quota.\n");

  const confirm = await ask(`Type "${config.resourceGroupName}" to confirm`);
  if (confirm !== config.resourceGroupName) {
    console.log("Aborted.");
    return;
  }

  await destroyResources(config);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "help";
  const projectRoot = await findProjectRoot(process.cwd());

  if (command === "help" || command === "--help" || command === "-h") {
    console.log(helpText());
    return;
  }

  if (command === "init") {
    await handleInit(projectRoot);
    return;
  }

  if (command === "deploy") {
    await handleDeploy(projectRoot);
    return;
  }

  if (command === "destroy") {
    await handleDestroy(projectRoot);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
