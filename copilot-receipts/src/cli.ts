#!/usr/bin/env node

import { Command, Option } from "commander";
import { GenerateCommand } from "./commands/generate.js";
import { ConfigCommand } from "./commands/config.js";
import { SetupCommand } from "./commands/setup.js";

const program = new Command();

program
  .name("copilot-receipts")
  .description(
    "Generate quirky, shareable receipts for your GitHub Copilot usage",
  )
  .version("1.0.0");

// generate command
program
  .command("generate")
  .description("Generate a receipt for your GitHub Copilot usage")
  .option("-d, --date <YYYY-MM-DD>", "Usage date to generate receipt for (defaults to most recent)")
  .addOption(
    new Option(
      "-o, --output <format...>",
      "Output format(s): html, console (comma-separated or repeated)",
    ).argParser((value: string, prev: string[] | undefined) => {
      const formats = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const valid = ["html", "console"];
      for (const f of formats) {
        if (!valid.includes(f)) {
          throw new Error(
            `Invalid output format "${f}". Valid formats: ${valid.join(", ")}`,
          );
        }
      }
      return [...(prev ?? []), ...formats];
    }),
  )
  .option("-l, --location <text>", "Override location detection")
  .option("--org <name>", "GitHub organization name (overrides config)")
  .option("--token <token>", "GitHub token (overrides config and env var)")
  .action(async (options) => {
    const command = new GenerateCommand();
    await command.execute(options);
  });

// config command
program
  .command("config")
  .description("Manage copilot-receipts configuration")
  .option("--show", "Display current configuration")
  .option("--set <key=value>", "Set a configuration value")
  .option("--reset", "Reset configuration to defaults")
  .action(async (options) => {
    const command = new ConfigCommand();
    await command.execute(options);
  });

// setup command
program
  .command("setup")
  .description(
    "Interactive setup wizard for copilot-receipts (org, token, preferences)",
  )
  .option("--uninstall", "Clear the stored configuration")
  .action(async (options) => {
    const command = new SetupCommand();
    await command.execute(options);
  });

// Default to generate if no command given
if (process.argv.length === 2) {
  process.argv.push("generate");
}

program.parse();
