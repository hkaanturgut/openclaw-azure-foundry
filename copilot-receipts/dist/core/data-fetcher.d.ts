import type { ParsedCopilotUsage } from "../types/copilot.js";
export declare class DataFetcher {
    /**
     * Fetch Copilot usage for a specific date (YYYY-MM-DD).
     * Falls back to the most recent available day if the requested date has no data.
     */
    fetchUsage(org: string, token: string, date?: string): Promise<ParsedCopilotUsage>;
    /**
     * Fetch raw usage days from GitHub API.
     */
    private fetchRawUsage;
    /**
     * Parse a raw usage day into a structured receipt-ready object.
     */
    private parseDay;
}
//# sourceMappingURL=data-fetcher.d.ts.map