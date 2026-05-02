import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { DEFAULT_CONFIG } from "../types/config.js";
export class ConfigManager {
    configPath;
    constructor() {
        const home = process.env.HOME || process.env.USERPROFILE || "";
        this.configPath = join(home, ".copilot-receipts.config.json");
    }
    async loadConfig() {
        if (!existsSync(this.configPath)) {
            return { ...DEFAULT_CONFIG };
        }
        try {
            const content = await readFile(this.configPath, "utf-8");
            const config = JSON.parse(content);
            return { ...DEFAULT_CONFIG, ...config };
        }
        catch {
            console.warn("Failed to parse config file, using defaults");
            return { ...DEFAULT_CONFIG };
        }
    }
    async saveConfig(config) {
        const configDir = dirname(this.configPath);
        if (!existsSync(configDir)) {
            await mkdir(configDir, { recursive: true });
        }
        await writeFile(this.configPath, JSON.stringify(config, null, 2), "utf-8");
    }
    async updateConfig(key, value) {
        const config = await this.loadConfig();
        config[key] = value;
        await this.saveConfig(config);
    }
    async resetConfig() {
        await this.saveConfig({ ...DEFAULT_CONFIG });
    }
    getConfigPath() {
        return this.configPath;
    }
}
//# sourceMappingURL=config-manager.js.map