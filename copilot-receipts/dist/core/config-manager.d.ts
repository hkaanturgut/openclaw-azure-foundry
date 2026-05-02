import type { ReceiptConfig } from "../types/config.js";
export declare class ConfigManager {
    private configPath;
    constructor();
    loadConfig(): Promise<ReceiptConfig>;
    saveConfig(config: ReceiptConfig): Promise<void>;
    updateConfig(key: keyof ReceiptConfig, value: string): Promise<void>;
    resetConfig(): Promise<void>;
    getConfigPath(): string;
}
//# sourceMappingURL=config-manager.d.ts.map