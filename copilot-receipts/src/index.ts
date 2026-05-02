// Public API exports for the package
export { DataFetcher } from "./core/data-fetcher.js";
export { ReceiptGenerator } from "./core/receipt-generator.js";
export { HtmlRenderer } from "./core/html-renderer.js";
export { ConfigManager } from "./core/config-manager.js";
export { LocationDetector } from "./utils/location.js";
export { GenerateCommand } from "./commands/generate.js";

// Type exports
export type {
  CopilotUsageDay,
  CopilotUsageBreakdown,
  EditorBreakdown,
  LanguageBreakdown,
  ParsedCopilotUsage,
} from "./types/copilot.js";
export type { ReceiptConfig } from "./types/config.js";
export type { ReceiptData } from "./core/receipt-generator.js";
