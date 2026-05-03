import chalk from "chalk";
import prompts from "prompts";
import ora from "ora";
import { ConfigManager } from "../core/config-manager.js";
export class SetupCommand {
    configManager = new ConfigManager();
    async execute(options) {
        console.log(chalk.cyan.bold("\nCopilot Receipts Setup\n"));
        try {
            if (options.uninstall) {
                await this.uninstall();
            }
            else {
                await this.install();
            }
        }
        catch (error) {
            if (error instanceof Error) {
                console.error(chalk.red(`\nError: ${error.message}`));
            }
            else {
                console.error(chalk.red("\nAn unknown error occurred."));
            }
            process.exit(1);
        }
    }
    async install() {
        const answers = await prompts([
            {
                type: "text",
                name: "org",
                message: "GitHub organization name:",
                validate: (v) => (v.trim() ? true : "Organization is required"),
            },
            {
                type: "password",
                name: "token",
                message: "GitHub token (needs read:org or manage_billing:copilot scope):",
                validate: (v) => (v.trim() ? true : "Token is required"),
            },
            {
                type: "text",
                name: "location",
                message: "Default location (leave blank to auto-detect):",
                initial: "",
            },
            {
                type: "text",
                name: "timezone",
                message: "Timezone (e.g. America/New_York, leave blank for local):",
                initial: "",
            },
        ]);
        if (!answers.org || !answers.token) {
            console.log(chalk.yellow("\nSetup cancelled."));
            return;
        }
        const spinner = ora("Saving configuration...").start();
        const config = {
            version: "1.0.0",
            org: answers.org,
            token: answers.token,
            location: answers.location || undefined,
            timezone: answers.timezone || undefined,
        };
        await this.configManager.saveConfig(config);
        spinner.succeed("Configuration saved!");
        console.log(chalk.green("\n✓ Configuration complete!"));
        console.log(chalk.gray(`  Config file: ${this.configManager.getConfigPath()}`));
        console.log(chalk.gray(`  Org: ${answers.org}`));
        console.log();
        console.log(chalk.cyan("Generate your first receipt:"));
        console.log(chalk.white("  npx copilot-receipts generate"));
        console.log();
        console.log(chalk.cyan("For daily receipts, add a cron job:"));
        console.log(chalk.white("  # Run daily at 6pm (adjust time to suit you)\n  0 18 * * * npx copilot-receipts generate --output html"));
        console.log();
    }
    async uninstall() {
        const spinner = ora("Resetting configuration...").start();
        await this.configManager.resetConfig();
        spinner.succeed("Configuration reset!");
        console.log(chalk.green("\n✓ Copilot Receipts configuration cleared."));
        console.log(chalk.gray(`  Config file preserved at: ${this.configManager.getConfigPath()}`));
        console.log();
    }
}
//# sourceMappingURL=setup.js.map