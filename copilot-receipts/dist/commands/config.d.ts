export interface ConfigOptions {
    show?: boolean;
    set?: string;
    reset?: boolean;
}
export declare class ConfigCommand {
    private configManager;
    execute(options: ConfigOptions): Promise<void>;
    private handleShow;
    private handleSet;
}
//# sourceMappingURL=config.d.ts.map