import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve, relative, isAbsolute } from "path";
import { homedir } from "os";
import type { ReceiptData } from "./receipt-generator.js";
import {
  formatPercent,
  formatNumber,
  formatDate,
  formatDateTime,
} from "../utils/formatting.js";

/** Sanitize a string so it is safe to use as part of a filename. */
function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
}

export class HtmlRenderer {
  private outputDir: string;

  constructor() {
    this.outputDir = resolve(join(homedir(), ".copilot-receipts", "receipts"));
  }

  async renderToFile(data: ReceiptData, receiptText: string): Promise<string> {
    if (!existsSync(this.outputDir)) {
      await mkdir(this.outputDir, { recursive: true });
    }

    const safeOrg = sanitizeFilePart(data.usage.org);
    const safeDate = sanitizeFilePart(data.usage.date);
    const filename = `copilot-${safeOrg}-${safeDate}.html`;
    const filePath = resolve(join(this.outputDir, filename));

    // Guard: ensure the resolved path stays within outputDir
    const rel = relative(this.outputDir, filePath);
    if (isAbsolute(rel) || rel.startsWith("..")) {
      throw new Error("Resolved output path escapes the receipts directory.");
    }

    const html = this.generateHtml(data, receiptText);
    await writeFile(filePath, html, "utf-8");
    return filePath;
  }

  fileUrl(filePath: string): string {
    return `file://${filePath}`;
  }

  generateHtml(data: ReceiptData, receiptText: string): string {
    const { usage } = data;
    const { config } = data;

    const editorRowsHtml = usage.editorBreakdowns
      .map((e) => {
        const rate =
          e.suggestions_count > 0
            ? formatPercent(
                (e.acceptances_count / e.suggestions_count) * 100,
              )
            : "—";
        return `<div class="line-item">
          <span>${this.capitalize(e.editor)}</span>
          <span>${formatNumber(e.suggestions_count)} suggestions (${rate})</span>
        </div>`;
      })
      .join("\n");

    const langRowsHtml = usage.languageBreakdowns
      .map((l) => {
        const rate =
          l.suggestions_count > 0
            ? formatPercent(
                (l.acceptances_count / l.suggestions_count) * 100,
              )
            : "—";
        return `<div class="line-item">
          <span>${this.capitalize(l.language)}</span>
          <span>${formatNumber(l.suggestions_count)} suggestions (${rate})</span>
        </div>`;
      })
      .join("\n");

    const chatHtml =
      usage.totalChatTurns > 0
        ? `<div class="section-header">Copilot Chat</div>
           <div class="line-item"><span>Turns</span><span>${formatNumber(usage.totalChatTurns)}</span></div>
           <div class="line-item"><span>Acceptances</span><span>${formatNumber(usage.totalChatAcceptances)}</span></div>
           <div class="line-item"><span>Active users</span><span>${formatNumber(usage.totalActiveChatUsers)}</span></div>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Copilot Receipt — ${usage.org} — ${usage.date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 15px;
      background: #1a1a2e;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .receipt {
      background: #f5f5f0;
      width: 400px;
      padding: 30px 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      position: relative;
      animation: slideIn 0.4s ease-out;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .receipt::before, .receipt::after {
      content: '';
      position: absolute;
      left: -4px; right: -4px;
      height: 14px;
      background: repeating-linear-gradient(
        90deg,
        transparent, transparent 10px,
        #f5f5f0 10px, #f5f5f0 20px
      );
    }
    .receipt::before { top: -14px; }
    .receipt::after  { bottom: -14px; }

    .logo-area {
      text-align: center;
      padding: 12px 0 8px;
    }

    .logo-svg { width: 48px; height: 48px; }

    .store-name {
      font-size: 18px;
      font-weight: bold;
      color: #0d1117;
      letter-spacing: 2px;
      margin-top: 8px;
    }

    .meta {
      text-align: center;
      color: #555;
      font-size: 13px;
      margin-bottom: 8px;
      line-height: 1.7;
    }

    .separator { border-top: 2px solid #333; margin: 12px 0; }
    .light-sep { border-top: 1px dashed #aaa; margin: 8px 0; }

    .section-header {
      font-weight: bold;
      color: #0d1117;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 1px;
      margin: 10px 0 4px;
    }

    .line-item {
      display: flex;
      justify-content: space-between;
      color: #444;
      font-size: 13px;
      padding: 2px 0;
    }

    .highlight-row {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      color: #0d1117;
      font-size: 14px;
      padding: 4px 0;
    }

    .footer {
      text-align: center;
      color: #777;
      font-size: 12px;
      margin-top: 12px;
      line-height: 1.8;
    }

    .pre-receipt {
      display: none;
    }
  </style>
</head>
<body>
  <div class="receipt">

    <!-- Logo -->
    <div class="logo-area">
      <svg class="logo-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="22" fill="#0d1117" stroke="#30363d" stroke-width="2"/>
        <path d="M24 10C16.27 10 10 16.27 10 24c0 6.19 4.01 11.44 9.56 13.32-.13-1.13-.25-2.88.05-4.12.28-1.12 1.87-7.92 1.87-7.92s-.48-.96-.48-2.37c0-2.22 1.29-3.88 2.89-3.88 1.36 0 2.02 1.02 2.02 2.25 0 1.37-.87 3.42-1.33 5.32-.38 1.59.8 2.88 2.36 2.88 2.83 0 5.01-2.98 5.01-7.29 0-3.81-2.74-6.47-6.65-6.47-4.53 0-7.19 3.4-7.19 6.91 0 1.37.52 2.83 1.18 3.63.13.16.15.3.11.46-.12.5-.39 1.59-.44 1.81-.07.29-.23.35-.53.21-1.99-.93-3.23-3.83-3.23-6.17 0-5.02 3.65-9.63 10.52-9.63 5.52 0 9.81 3.93 9.81 9.19 0 5.48-3.46 9.89-8.26 9.89-1.61 0-3.13-.84-3.65-1.83l-.99 3.72c-.36 1.38-1.33 3.12-1.98 4.17.49.15.99.23 1.51.27.33.02.66.03 1 .03 7.73 0 14-6.27 14-14S31.73 10 24 10z" fill="#f0f6fc"/>
      </svg>
      <div class="store-name">GITHUB COPILOT</div>
    </div>

    <div class="meta">
      Location: ${this.escapeHtml(data.location)}<br>
      Org: ${this.escapeHtml(usage.org)}<br>
      ${formatDate(usage.date, config.timezone)}<br>
      <small>Generated: ${formatDateTime(data.generatedAt, config.timezone)}</small>
    </div>

    <div class="separator"></div>

    <!-- Code Completions -->
    <div class="section-header">Code Completions</div>
    <div class="line-item">
      <span>Suggestions</span>
      <span>${formatNumber(usage.totalSuggestions)}</span>
    </div>
    <div class="line-item">
      <span>Acceptances</span>
      <span>${formatNumber(usage.totalAcceptances)}</span>
    </div>
    <div class="line-item">
      <span>Lines suggested</span>
      <span>${formatNumber(usage.totalLinesSuggested)}</span>
    </div>
    <div class="line-item">
      <span>Lines accepted</span>
      <span>${formatNumber(usage.totalLinesAccepted)}</span>
    </div>

    ${
      usage.totalChatTurns > 0
        ? `<div class="light-sep"></div>
           ${chatHtml}`
        : ""
    }

    ${
      usage.editorBreakdowns.length > 0
        ? `<div class="light-sep"></div>
           <div class="section-header">By Editor</div>
           ${editorRowsHtml}`
        : ""
    }

    ${
      usage.languageBreakdowns.length > 0
        ? `<div class="light-sep"></div>
           <div class="section-header">Top Languages</div>
           ${langRowsHtml}`
        : ""
    }

    <div class="separator"></div>

    <div class="highlight-row">
      <span>ACCEPTANCE RATE</span>
      <span>${formatPercent(usage.acceptanceRate)}</span>
    </div>
    <div class="highlight-row">
      <span>LINE ACCEPTANCE</span>
      <span>${formatPercent(usage.lineAcceptanceRate)}</span>
    </div>
    <div class="light-sep"></div>
    <div class="highlight-row">
      <span>ACTIVE USERS</span>
      <span>${formatNumber(usage.totalActiveUsers)}</span>
    </div>

    <div class="separator"></div>

    <div class="footer">
      CASHIER: GitHub Copilot<br>
      Thank you for building!<br>
      <a href="https://github.com/features/copilot" style="color:#0969da;">github.com/features/copilot</a>
    </div>

  </div>
  <!-- Raw receipt text (hidden, for reference) -->
  <pre class="pre-receipt">${this.escapeHtml(receiptText)}</pre>
</body>
</html>`;
  }

  private capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
