export interface SetupOptions {
    uninstall?: boolean;
}
export declare class SetupCommand {
    private configManager;
    execute(options: SetupOptions): Promise<void>;
    private install;
    private uninstall;
}
//# sourceMappingURL=setup.d.ts.map