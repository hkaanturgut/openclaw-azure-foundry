#!/usr/bin/env node

import { collectConfig, collectConfigUpdate, configPath, loadConfig, saveConfig } from "./config.js";
import { ask, askYesNo } from "./prompt.js";
import { writeGeneratedParams } from "./params.js";
import { preflightChecks, runDeployment, runValidation, waitForReady, approvePairing, destroyResources, ensureAzLogin, fetchExistingToken, updateOpenClawApp } from "./azure.js";

function helpText(): string {
  return `openclaw-azure-cli

Usage:
  openclaw-azure init
  openclaw-azure deploy
  openclaw-azure update [--rotate-token]
  openclaw-azure pair
  openclaw-azure destroy
  openclaw-azure help

Commands:
  init      Prompt for infrastructure values and save local config.
  deploy    Run Azure preflight checks and deploy infrastructure.
  update    Update infrastructure, OpenClaw app, or both on a running deployment.
  pair      Approve a Telegram pairing code on a running deployment.
  destroy   Delete all deployed resources and purge soft-deleted items.

Flags:
  --rotate-token   (update) Prompt for a new Telegram bot token instead of reusing the existing one.
`;
}

async function handleInit(): Promise<void> {
  const config = await collectConfig();
  await saveConfig(config);
  const paramsPath = await writeGeneratedParams(config);
  console.log(`Saved config: ${configPath()}`);
  console.log(`Generated params: ${paramsPath}`);
}

async function handleDeploy(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    throw new Error("No valid config found. Run `openclaw-azure init` first.");
  }

  const token = await ask("Telegram bot token (input visible)");
  if (!token) {
    throw new Error("Telegram bot token is required.");
  }

  const paramsPath = await writeGeneratedParams(config);

  console.log("Checking Azure login...");
  await ensureAzLogin();

  console.log("Running preflight checks...");
  await preflightChecks();

  console.log("Deploying infrastructure...");
  await runDeployment(
    config.location,
    paramsPath,
    config.sshPublicKeyPath,
    token,
  );

  console.log("\n✅ Deployment completed. Running validation...\n");
  await runValidation(config);

  console.log("\n✅ Validation complete. Waiting for OpenClaw to become ready...\n");
  await waitForReady(config);

  console.log("\n✅ OpenClaw is up and running!");
  console.log("To pair your Telegram bot:");
  console.log("1. Send any message to your bot on Telegram");
  console.log("2. The bot will respond with a pairing code\n");

  const wantPairing = await askYesNo("Do you have a pairing code to approve now?", true);
  if (wantPairing) {
    const pairingCode = await ask("Enter the pairing code from Telegram");
    if (!pairingCode) {
      throw new Error("Pairing code is required.");
    }
    await approvePairing(config.resourceGroupName, config.vmName, pairingCode);
    console.log("\n🎉 Pairing approved! Send a message to your bot — you should get a GPT-4o response.");
  } else {
    console.log("\nYou can approve pairing later by running: openclaw-azure pair");
  }
}

async function handlePair(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    throw new Error("No valid config found. Run `openclaw-azure init` first.");
  }

  console.log("Checking Azure login...");
  await ensureAzLogin();

  console.log("Checking if OpenClaw is ready...\n");
  await waitForReady(config);

  console.log("\n✅ OpenClaw is up and running!");
  console.log("Send a message to your Telegram bot to get a pairing code.\n");
  const pairingCode = await ask("Enter the pairing code from Telegram");
  if (!pairingCode) { throw new Error("Pairing code is required."); }

  await approvePairing(config.resourceGroupName, config.vmName, pairingCode);
  console.log("\n🎉 Pairing approved! Your bot should now respond.");
}

type UpdateMode = "infra" | "app" | "both";

async function handleUpdate(rotateToken: boolean): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    throw new Error("No valid config found. Run `openclaw-azure init` first.");
  }

  console.log("\nWhat would you like to update?");
  console.log("  1) Infrastructure only  (VM size, model, capacity, etc.)");
  console.log("  2) OpenClaw app only    (reinstall latest version on the VM)");
  console.log("  3) Both\n");
  const modeAnswer = await ask("Choose [1/2/3]", "3");
  const modeMap: Record<string, UpdateMode> = { "1": "infra", "2": "app", "3": "both" };
  const mode: UpdateMode = modeMap[modeAnswer] ?? "both";

  let updatedConfig = config;

  if (mode === "infra" || mode === "both") {
    const wantEdit = await askYesNo("Do you want to change infrastructure settings?", true);
    if (wantEdit) {
      updatedConfig = await collectConfigUpdate(config);
      await saveConfig(updatedConfig);
      console.log(`\nConfig updated: ${configPath()}`);
    }
  }

  console.log("Checking Azure login...");
  await ensureAzLogin();

  if (mode === "infra" || mode === "both") {
    let token: string;
    if (rotateToken) {
      token = await ask("New Telegram bot token (input visible)");
      if (!token) {
        throw new Error("Telegram bot token is required when using --rotate-token.");
      }
    } else {
      token = await fetchExistingToken(updatedConfig.resourceGroupName, updatedConfig.vmName, updatedConfig.keyVaultName);
    }

    const paramsPath = await writeGeneratedParams(updatedConfig);

    console.log("Running preflight checks...");
    await preflightChecks();

    console.log("Deploying infrastructure updates...");
    await runDeployment(
      updatedConfig.location,
      paramsPath,
      updatedConfig.sshPublicKeyPath,
      token,
    );
    console.log("\n\u2705 Infrastructure update completed.");
  }

  if (mode === "app" || mode === "both") {
    await updateOpenClawApp(updatedConfig);
    await waitForReady(updatedConfig);
    console.log("\n\u2705 OpenClaw app updated and running!");
  }

  if (mode === "infra") {
    console.log("\n\u2705 Update complete. Run `openclaw-azure update` with app mode to update OpenClaw itself.");
  }
}

async function handleDestroy(): Promise<void> {
  const rgName = await ask("Enter the resource group name to destroy");
  if (!rgName) {
    console.log("No resource group name provided. Aborted.");
    return;
  }

  console.log(`\n⚠️  WARNING: This will permanently delete ALL resources in resource group "${rgName}"`);
  console.log("  and purge soft-deleted AI Services to free quota.\n");

  const confirm = await ask(`Type "${rgName}" to confirm`);
  if (confirm !== rgName) {
    console.log("Aborted.");
    return;
  }

  await destroyResources(rgName);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "help";

  if (command === "help" || command === "--help" || command === "-h") {
    console.log(helpText());
    return;
  }

  if (command === "init") {
    await handleInit();
    return;
  }

  if (command === "deploy") {
    await handleDeploy();
    return;
  }

  if (command === "pair") {
    await handlePair();
    return;
  }

  if (command === "update") {
    const rotateToken = process.argv.includes("--rotate-token");
    await handleUpdate(rotateToken);
    return;
  }

  if (command === "destroy") {
    await handleDestroy();
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
