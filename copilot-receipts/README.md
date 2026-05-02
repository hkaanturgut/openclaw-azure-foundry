# copilot-receipts

Generate quirky, shareable receipts for your GitHub Copilot usage — inspired by [claude-receipts](https://github.com/chrishutchinson/claude-receipts).

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ●  GitHub Copilot  ●
  ╔═══════════════╗
  ║  < / >        ║
  ╚═══════════════╝
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       Location: The Cloud
          Org: my-org
      2024-06-24 (Monday)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEM                    COUNT   RATE
─────────────────────────────────────
CODE COMPLETIONS
  Suggestions              1,000
  Acceptances                800   80.0%
  Lines suggested          1,800
  Lines accepted           1,000   55.6%
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACCEPTANCE RATE                80.0%
LINE ACCEPTANCE                55.6%
─────────────────────────────────────
ACTIVE USERS                      10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        CASHIER: GitHub Copilot
        Thank you for building!
   github.com/features/copilot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Installation

```bash
npx copilot-receipts setup
```

This will:
- Prompt for your GitHub organization name
- Prompt for a GitHub token
- Store configuration at `~/.copilot-receipts.config.json`

## Requirements

- Node.js >= 20.0.0
- A GitHub organization with **GitHub Copilot Business** or **GitHub Copilot Enterprise** enabled
- A GitHub token with `read:org` or `manage_billing:copilot` scope

> **Note:** GitHub Copilot's usage API is only available at the organization/enterprise level (not individual accounts).

## Commands

### `generate`

Generate a receipt for your organization's GitHub Copilot usage.

```bash
# Most recent available day (console output)
npx copilot-receipts generate

# Specific date
npx copilot-receipts generate --date 2024-06-24

# HTML receipt (saved to ~/.copilot-receipts/receipts/ and opened in browser)
npx copilot-receipts generate --output html

# Both console and HTML
npx copilot-receipts generate --output console,html

# Override org and token inline
npx copilot-receipts generate --org my-org --token ghp_...
```

**Options:**

- `-d, --date <YYYY-MM-DD>` — Specific date to generate a receipt for (defaults to most recent)
- `-o, --output <format>` — Output format: `console` (default) or `html` (supports multiple, comma-separated)
- `-l, --location <text>` — Override location detection
- `--org <name>` — GitHub organization name (overrides config)
- `--token <token>` — GitHub token (overrides config and `GITHUB_TOKEN` env var)

### `setup`

Interactive wizard to configure copilot-receipts.

```bash
# Run interactive setup
npx copilot-receipts setup

# Clear stored configuration
npx copilot-receipts setup --uninstall
```

### `config`

Manage configuration values.

```bash
# Show current configuration
npx copilot-receipts config --show

# Set a value
npx copilot-receipts config --set org=my-org
npx copilot-receipts config --set token=ghp_...
npx copilot-receipts config --set location="San Francisco, CA"
npx copilot-receipts config --set timezone="America/Los_Angeles"

# Reset to defaults
npx copilot-receipts config --reset
```

**Available settings:**

| Key        | Description                                      |
|------------|--------------------------------------------------|
| `org`      | GitHub organization name                         |
| `token`    | GitHub personal access token                     |
| `location` | Default location string (otherwise auto-detected) |
| `timezone` | Timezone for date formatting (e.g. `America/New_York`) |

## Configuration

Configuration is stored at `~/.copilot-receipts.config.json`.

```json
{
  "version": "1.0.0",
  "org": "my-org",
  "token": "ghp_...",
  "location": "San Francisco, CA",
  "timezone": "America/Los_Angeles"
}
```

The token can also be provided via the `GITHUB_TOKEN` or `GH_TOKEN` environment variable.

## Automated Daily Receipts

Since GitHub Copilot doesn't have a "session end" hook, you can schedule daily receipt generation with a cron job:

```bash
# Open crontab
crontab -e

# Run every day at 6pm and save HTML
0 18 * * * npx copilot-receipts generate --output html
```

Or add it to a CI/CD pipeline to send receipts to your team.

## How It Works

1. **GitHub API**: Calls `GET /orgs/{org}/copilot/usage` with your token
2. **Data Parsing**: Aggregates daily usage by editor and language
3. **Receipt Generation**: Formats data into a terminal receipt or styled HTML page
4. **Location Detection**: Auto-detects your location via IP geolocation (offline, using geoip-lite), or uses your configured location
5. **HTML Output**: Saves a styled receipt to `~/.copilot-receipts/receipts/` and opens it in your browser

## License

MIT
