import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import type { ReceiptConfig } from "../types/config.js";
import { DEFAULT_CONFIG } from "../types/config.js";

export class ConfigManager {
  private configPath: string;

  constructor() {
    this.configPath = join(homedir(), ".copilot-receipts.config.json");
  }

  async loadConfig(): Promise<ReceiptConfig> {
    if (!existsSync(this.configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    try {
      const content = await readFile(this.configPath, "utf-8");
      const config = JSON.parse(content) as Partial<ReceiptConfig>;
      return { ...DEFAULT_CONFIG, ...config };
    } catch {
      console.warn("Failed to parse config file, using defaults");
      return { ...DEFAULT_CONFIG };
    }
  }

  async saveConfig(config: ReceiptConfig): Promise<void> {
    const configDir = dirname(this.configPath);
    if (!existsSync(configDir)) {
      await mkdir(configDir, { recursive: true });
    }
    await writeFile(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  async updateConfig(key: keyof ReceiptConfig, value: string): Promise<void> {
    const config = await this.loadConfig();
    switch (key) {
      case "version":
      case "org":
      case "token":
      case "location":
      case "timezone":
        config[key] = value;
        break;
    }
    await this.saveConfig(config);
  }

  async resetConfig(): Promise<void> {
    await this.saveConfig({ ...DEFAULT_CONFIG });
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
