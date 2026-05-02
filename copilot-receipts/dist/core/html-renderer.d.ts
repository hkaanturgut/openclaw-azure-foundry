import type { ReceiptData } from "./receipt-generator.js";
export declare class HtmlRenderer {
    private outputDir;
    constructor();
    renderToFile(data: ReceiptData, receiptText: string): Promise<string>;
    openInBrowser(filePath: string): Promise<void>;
    generateHtml(data: ReceiptData, receiptText: string): string;
    private capitalize;
    private escapeHtml;
}
//# sourceMappingURL=html-renderer.d.ts.map