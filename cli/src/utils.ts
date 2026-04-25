import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

/** Resolve the package root directory (where package.json lives). */
export function getPackageDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // In dev: src/utils.ts → ../ ; In dist: dist/utils.js → ../
  return path.resolve(path.dirname(thisFile), "..");
}

/** Resolve the path to the bundled infrastructure template. */
export function getTemplatePath(): string {
  return path.join(getPackageDir(), "infrastructure", "main.bicep");
}

/** State directory in the user's current working directory. */
export function getStateDir(): string {
  return path.join(process.cwd(), ".openclaw-azure");
}

export function expandTilde(inputPath: string): string {
  if (inputPath === "~") {
    return os.homedir();
  }
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

export function runCommand(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function generateSshKeypair(): Promise<string> {
  const keyDir = path.join(getStateDir(), "ssh");
  await fs.mkdir(keyDir, { recursive: true });
  const keyPath = path.join(keyDir, "id_ed25519");

  try {
    await fs.access(keyPath);
    console.log(`SSH keypair already exists at ${keyPath}, reusing it.`);
    return `${keyPath}.pub`;
  } catch {
    // Key doesn't exist yet — generate it
  }

  const code = await runCommand("ssh-keygen", [
    "-t", "ed25519",
    "-f", keyPath,
    "-N", "",
    "-C", "openclaw-azure-cli",
  ]);
  if (code !== 0) {
    throw new Error("Failed to generate SSH keypair.");
  }
  console.log(`SSH keypair generated at ${keyPath}`);
  return `${keyPath}.pub`;
}

export async function runOrThrow(command: string, args: string[], message: string): Promise<void> {
  const code = await runCommand(command, args);
  if (code !== 0) {
    throw new Error(message);
  }
}

/** Run a command and capture its stdout as a string. Returns { code, stdout }. */
export function runCapture(command: string, args: string[]): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["inherit", "pipe", "inherit"] });
    const chunks: Buffer[] = [];
    child.stdout!.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout: Buffer.concat(chunks).toString("utf8").trim() });
    });
  });
}
