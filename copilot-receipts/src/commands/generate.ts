import chalk from "chalk";
import ora from "ora";
import { DataFetcher } from "../core/data-fetcher.js";
import { ReceiptGenerator } from "../core/receipt-generator.js";
import { HtmlRenderer } from "../core/html-renderer.js";
import { ConfigManager } from "../core/config-manager.js";
import { LocationDetector } from "../utils/location.js";

export type OutputFormat = "html" | "console";

export interface GenerateOptions {
  date?: string;
  output?: string[];
  location?: string;
  org?: string;
  token?: string;
}

export class GenerateCommand {
  private dataFetcher = new DataFetcher();
  private receiptGenerator = new ReceiptGenerator();
  private htmlRenderer = new HtmlRenderer();
  private configManager = new ConfigManager();
  private locationDetector = new LocationDetector();

  async execute(options: GenerateOptions): Promise<void> {
    const spinner = ora("Generating receipt...").start();

    try {
      const config = await this.configManager.loadConfig();

      const org = options.org ?? config.org;
      const token =
        options.token ??
        config.token ??
        process.env.GITHUB_TOKEN ??
        process.env.GH_TOKEN;

      if (!org) {
        spinner.fail("Organization name is required.");
        console.error(
          chalk.red(
            '\nProvide --org <name> or set it with: copilot-receipts config --set org=<name>',
          ),
        );
        process.exit(1);
      }

      if (!token) {
        spinner.fail("GitHub token is required.");
        console.error(
          chalk.red(
            '\nProvide --token <token>, set GITHUB_TOKEN env var, or: copilot-receipts config --set token=<token>',
          ),
        );
        process.exit(1);
      }

      // Fetch usage data
      spinner.text = "Fetching Copilot usage from GitHub API...";
      const usage = await this.dataFetcher.fetchUsage(org, token, options.date);

      // Get location
      spinner.text = "Detecting location...";
      const location =
        options.location ??
        (await this.locationDetector.getLocation(config));

      const receiptData = {
        usage,
        location,
        config,
        generatedAt: new Date(),
      };

      const receiptText = this.receiptGenerator.generateReceipt(receiptData);

      spinner.succeed("Receipt generated!");

      const outputFormats = [
        ...new Set(options.output ?? ["console"]),
      ] as OutputFormat[];

      for (const format of outputFormats) {
        switch (format) {
          case "console":
            console.log("\n" + receiptText);
            break;
          case "html": {
            const filePath = await this.htmlRenderer.renderToFile(
              receiptData,
              receiptText,
            );
            const url = this.htmlRenderer.fileUrl(filePath);
            console.log(chalk.green(`\n✓ HTML receipt saved: ${filePath}`));
            console.log(chalk.cyan(`  Open in browser: ${url}`));
            break;
          }
          default:
            console.warn(chalk.yellow(`Unknown output format: ${format}`));
        }
      }
    } catch (error) {
      spinner.fail("Failed to generate receipt.");
      if (error instanceof Error) {
        console.error(chalk.red(`\nError: ${error.message}`));
      } else {
        console.error(chalk.red("\nAn unknown error occurred."));
      }
      process.exit(1);
    }
  }
}
