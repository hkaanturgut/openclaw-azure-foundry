import type {
  CopilotUsageDay,
  EditorBreakdown,
  LanguageBreakdown,
  ParsedCopilotUsage,
} from "../types/copilot.js";

const GITHUB_API_BASE = "https://api.github.com";

export class DataFetcher {
  /**
   * Fetch Copilot usage for a specific date (YYYY-MM-DD).
   * Falls back to the most recent available day if the requested date has no data.
   */
  async fetchUsage(
    org: string,
    token: string,
    date?: string,
  ): Promise<ParsedCopilotUsage> {
    const days = await this.fetchRawUsage(org, token);

    if (days.length === 0) {
      throw new Error(
        "No Copilot usage data found. Ensure the organization has Copilot enabled and your token has the required scopes (read:org or manage_billing:copilot).",
      );
    }

    let day: CopilotUsageDay;

    if (date) {
      const found = days.find((d) => d.day === date);
      if (!found) {
        throw new Error(
          `No usage data found for ${date}. Available dates: ${days
            .map((d) => d.day)
            .slice(0, 5)
            .join(", ")}`,
        );
      }
      day = found;
    } else {
      // Use the most recent day with data
      day = days[days.length - 1];
    }

    return this.parseDay(day, org);
  }

  /**
   * Fetch raw usage days from GitHub API.
   */
  private async fetchRawUsage(
    org: string,
    token: string,
  ): Promise<CopilotUsageDay[]> {
    const url = `${GITHUB_API_BASE}/orgs/${encodeURIComponent(org)}/copilot/usage?per_page=28`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 401) {
        throw new Error(
          "GitHub API authentication failed. Check your token is valid.",
        );
      }
      if (response.status === 403) {
        throw new Error(
          "Access denied. Your token requires 'read:org' or 'manage_billing:copilot' scope, and the organization must have GitHub Copilot Business/Enterprise enabled.",
        );
      }
      if (response.status === 404) {
        throw new Error(
          `Organization '${org}' not found, or Copilot Business/Enterprise is not enabled for this organization.`,
        );
      }
      throw new Error(
        `GitHub API error ${response.status}: ${body.slice(0, 200)}`,
      );
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        `Unexpected response from GitHub Copilot usage API: expected an array but received ${typeof data}`,
      );
    }

    return data as CopilotUsageDay[];
  }

  /**
   * Parse a raw usage day into a structured receipt-ready object.
   */
  private parseDay(day: CopilotUsageDay, org: string): ParsedCopilotUsage {
    const acceptanceRate =
      day.total_suggestions_count > 0
        ? (day.total_acceptances_count / day.total_suggestions_count) * 100
        : 0;

    const lineAcceptanceRate =
      day.total_lines_suggested > 0
        ? (day.total_lines_accepted / day.total_lines_suggested) * 100
        : 0;

    // Aggregate by editor
    const editorMap = new Map<string, EditorBreakdown>();
    for (const b of day.breakdown ?? []) {
      const existing = editorMap.get(b.editor) ?? {
        editor: b.editor,
        suggestions_count: 0,
        acceptances_count: 0,
        lines_suggested: 0,
        lines_accepted: 0,
        active_users: 0,
      };
      existing.suggestions_count += b.suggestions_count;
      existing.acceptances_count += b.acceptances_count;
      existing.lines_suggested += b.lines_suggested;
      existing.lines_accepted += b.lines_accepted;
      existing.active_users = Math.max(existing.active_users, b.active_users);
      editorMap.set(b.editor, existing);
    }

    // Aggregate by language (top 5 by suggestions)
    const languageMap = new Map<string, LanguageBreakdown>();
    for (const b of day.breakdown ?? []) {
      const existing = languageMap.get(b.language) ?? {
        language: b.language,
        suggestions_count: 0,
        acceptances_count: 0,
        lines_suggested: 0,
        lines_accepted: 0,
        active_users: 0,
      };
      existing.suggestions_count += b.suggestions_count;
      existing.acceptances_count += b.acceptances_count;
      existing.lines_suggested += b.lines_suggested;
      existing.lines_accepted += b.lines_accepted;
      existing.active_users = Math.max(existing.active_users, b.active_users);
      languageMap.set(b.language, existing);
    }

    const languageBreakdowns = [...languageMap.values()]
      .sort((a, b) => b.suggestions_count - a.suggestions_count)
      .slice(0, 5);

    return {
      date: day.day,
      totalSuggestions: day.total_suggestions_count,
      totalAcceptances: day.total_acceptances_count,
      acceptanceRate,
      totalLinesSuggested: day.total_lines_suggested,
      totalLinesAccepted: day.total_lines_accepted,
      lineAcceptanceRate,
      totalActiveUsers: day.total_active_users,
      totalChatAcceptances: day.total_chat_acceptances,
      totalChatTurns: day.total_chat_turns,
      totalActiveChatUsers: day.total_active_chat_users,
      editorBreakdowns: [...editorMap.values()],
      languageBreakdowns,
      org,
    };
  }
}
