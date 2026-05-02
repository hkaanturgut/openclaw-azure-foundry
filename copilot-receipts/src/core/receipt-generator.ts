import type { ParsedCopilotUsage } from "../types/copilot.js";
import type { ReceiptConfig } from "../types/config.js";
import { formatPercent, formatNumber, formatDate } from "../utils/formatting.js";
import { getHeader, SEPARATOR, LIGHT_SEPARATOR } from "../utils/ascii-art.js";

export interface ReceiptData {
  usage: ParsedCopilotUsage;
  location: string;
  config: ReceiptConfig;
  generatedAt: Date;
}

export class ReceiptGenerator {
  generateReceipt(data: ReceiptData): string {
    const lines: string[] = [];
    const { usage } = data;

    // Header
    lines.push(SEPARATOR);
    lines.push(getHeader());
    lines.push(SEPARATOR);
    lines.push("");

    // Meta info
    lines.push(this.centerText(`Location: ${data.location}`, 35));
    lines.push(this.centerText(`Org: ${usage.org}`, 35));
    lines.push(this.centerText(formatDate(usage.date, data.config.timezone), 35));
    lines.push("");

    // Code completions section
    lines.push(SEPARATOR);
    lines.push(this.padLine("ITEM", "COUNT", "RATE"));
    lines.push(LIGHT_SEPARATOR);

    lines.push(this.boldLabel("Code Completions"));
    lines.push(
      this.padLine(
        "  Suggestions",
        formatNumber(usage.totalSuggestions),
        "",
      ),
    );
    lines.push(
      this.padLine(
        "  Acceptances",
        formatNumber(usage.totalAcceptances),
        formatPercent(usage.acceptanceRate),
      ),
    );
    lines.push(
      this.padLine(
        "  Lines suggested",
        formatNumber(usage.totalLinesSuggested),
        "",
      ),
    );
    lines.push(
      this.padLine(
        "  Lines accepted",
        formatNumber(usage.totalLinesAccepted),
        formatPercent(usage.lineAcceptanceRate),
      ),
    );
    lines.push("");

    // Chat section (only if there is chat data)
    if (usage.totalChatTurns > 0) {
      lines.push(this.boldLabel("Copilot Chat"));
      lines.push(
        this.padLine(
          "  Turns",
          formatNumber(usage.totalChatTurns),
          "",
        ),
      );
      lines.push(
        this.padLine(
          "  Acceptances",
          formatNumber(usage.totalChatAcceptances),
          usage.totalChatTurns > 0
            ? formatPercent(
                (usage.totalChatAcceptances / usage.totalChatTurns) * 100,
              )
            : "—",
        ),
      );
      lines.push(
        this.padLine(
          "  Active users",
          formatNumber(usage.totalActiveChatUsers),
          "",
        ),
      );
      lines.push("");
    }

    // Editor breakdown
    if (usage.editorBreakdowns.length > 0) {
      lines.push(LIGHT_SEPARATOR);
      lines.push(this.boldLabel("By Editor"));
      for (const editor of usage.editorBreakdowns) {
        const rate =
          editor.suggestions_count > 0
            ? formatPercent(
                (editor.acceptances_count / editor.suggestions_count) * 100,
              )
            : "—";
        lines.push(
          this.padLine(
            `  ${this.capitalize(editor.editor)}`,
            formatNumber(editor.suggestions_count),
            rate,
          ),
        );
      }
      lines.push("");
    }

    // Language breakdown
    if (usage.languageBreakdowns.length > 0) {
      lines.push(LIGHT_SEPARATOR);
      lines.push(this.boldLabel("Top Languages"));
      for (const lang of usage.languageBreakdowns) {
        const rate =
          lang.suggestions_count > 0
            ? formatPercent(
                (lang.acceptances_count / lang.suggestions_count) * 100,
              )
            : "—";
        lines.push(
          this.padLine(
            `  ${this.capitalize(lang.language)}`,
            formatNumber(lang.suggestions_count),
            rate,
          ),
        );
      }
      lines.push("");
    }

    // Summary totals
    lines.push(SEPARATOR);
    lines.push(
      this.padLine(
        "ACCEPTANCE RATE",
        "",
        formatPercent(usage.acceptanceRate),
      ),
    );
    lines.push(
      this.padLine("LINE ACCEPTANCE", "", formatPercent(usage.lineAcceptanceRate)),
    );
    lines.push(LIGHT_SEPARATOR);
    lines.push(
      this.padLine("ACTIVE USERS", "", formatNumber(usage.totalActiveUsers)),
    );
    lines.push(SEPARATOR);
    lines.push("");

    // Footer
    lines.push(this.centerText("CASHIER: GitHub Copilot", 35));
    lines.push("");
    lines.push(this.centerText("Thank you for building!", 35));
    lines.push(this.centerText("github.com/features/copilot", 35));
    lines.push("");
    lines.push(SEPARATOR);

    return lines.join("\n");
  }

  private padLine(
    left: string,
    middle: string,
    right: string,
    width: number = 35,
  ): string {
    const rightLen = right.length;
    const leftLen = left.length;
    const middleLen = middle.length;
    const totalContent = leftLen + middleLen + rightLen;
    const availableSpace = width - totalContent;

    if (availableSpace < 0) {
      return `${left} ${middle} ${right}`;
    }

    const middleSpace = Math.floor(availableSpace / 2);
    const rightSpace = availableSpace - middleSpace;

    return left + " ".repeat(middleSpace) + middle + " ".repeat(rightSpace) + right;
  }

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(padding) + text;
  }

  private boldLabel(text: string): string {
    return text.toUpperCase();
  }

  private capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
