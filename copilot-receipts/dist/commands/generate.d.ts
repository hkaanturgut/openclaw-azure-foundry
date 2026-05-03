export type OutputFormat = "html" | "console";
export interface GenerateOptions {
    date?: string;
    output?: string[];
    location?: string;
    org?: string;
    token?: string;
}
export declare class GenerateCommand {
    private dataFetcher;
    private receiptGenerator;
    private htmlRenderer;
    private configManager;
    private locationDetector;
    execute(options: GenerateOptions): Promise<void>;
}
//# sourceMappingURL=generate.d.ts.map