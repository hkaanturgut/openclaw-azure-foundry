import type { ParsedCopilotUsage } from "../types/copilot.js";
import type { ReceiptConfig } from "../types/config.js";
export interface ReceiptData {
    usage: ParsedCopilotUsage;
    location: string;
    config: ReceiptConfig;
    generatedAt: Date;
}
export declare class ReceiptGenerator {
    generateReceipt(data: ReceiptData): string;
    private padLine;
    private centerText;
    private boldLabel;
    private capitalize;
}
//# sourceMappingURL=receipt-generator.d.ts.map