import chalk from "chalk";
import { ConfigManager } from "../core/config-manager.js";
import type { ReceiptConfig } from "../types/config.js";

const VALID_KEYS: Array<keyof ReceiptConfig> = [
  "org",
  "token",
  "location",
  "timezone",
];

export interface ConfigOptions {
  show?: boolean;
  set?: string;
  reset?: boolean;
}

export class ConfigCommand {
  private configManager = new ConfigManager();

  async execute(options: ConfigOptions): Promise<void> {
    try {
      if (options.reset) {
        await this.configManager.resetConfig();
        console.log(chalk.green("✓ Configuration reset to defaults."));
        return;
      }

      if (options.set) {
        await this.handleSet(options.set);
        return;
      }

      // Default: show
      await this.handleShow();
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      } else {
        console.error(chalk.red("An unknown error occurred."));
      }
      process.exit(1);
    }
  }

  private async handleShow(): Promise<void> {
    const config = await this.configManager.loadConfig();
    console.log(chalk.cyan.bold("\nCopilot Receipts Configuration\n"));
    console.log(`  Config file: ${this.configManager.getConfigPath()}\n`);
    for (const key of VALID_KEYS) {
      const value = config[key];
      const display =
        key === "token" && value
          ? `${String(value).slice(0, 6)}...${String(value).slice(-4)}`
          : (value ?? chalk.gray("(not set)"));
      console.log(`  ${key}: ${display}`);
    }
    console.log();
  }

  private async handleSet(keyValue: string): Promise<void> {
    const eqIndex = keyValue.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(
        `Invalid format. Use: --set key=value  (e.g. --set org=my-org)`,
      );
    }

    const key = keyValue.slice(0, eqIndex) as keyof ReceiptConfig;
    const value = keyValue.slice(eqIndex + 1);

    if (!VALID_KEYS.includes(key)) {
      throw new Error(
        `Unknown config key: "${key}". Valid keys: ${VALID_KEYS.join(", ")}`,
      );
    }

    await this.configManager.updateConfig(key, value);
    const display =
      key === "token"
        ? `${value.slice(0, 6)}...${value.slice(-4)}`
        : value;
    console.log(chalk.green(`✓ Set ${key} = ${display}`));
  }
}
