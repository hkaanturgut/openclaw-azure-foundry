import { describe, it, expect, vi, beforeEach } from "vitest";
import { validConfig } from "./fixtures.js";

// Mock the prompt module before importing config
vi.mock("../prompt.js", () => ({
  ask: vi.fn(),
  askYesNo: vi.fn(),
  askNumber: vi.fn(),
}));

import { collectConfigUpdate } from "../config.js";
import { ask, askNumber } from "../prompt.js";

const mockAsk = vi.mocked(ask);
const mockAskNumber = vi.mocked(askNumber);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("collectConfigUpdate", () => {
  it("preserves immutable fields when user accepts all defaults", async () => {
    const existing = validConfig();

    // Simulate user pressing Enter for all prompts (use defaults)
    mockAsk.mockImplementation((_q: string, defaultValue?: string) =>
      Promise.resolve(defaultValue ?? ""),
    );
    mockAskNumber.mockImplementation((_q: string, defaultValue: number) =>
      Promise.resolve(defaultValue),
    );

    const updated = await collectConfigUpdate(existing);

    // Immutable fields must be identical
    expect(updated.suffix).toBe(existing.suffix);
    expect(updated.resourceGroupName).toBe(existing.resourceGroupName);
    expect(updated.vnetName).toBe(existing.vnetName);
    expect(updated.vmName).toBe(existing.vmName);
    expect(updated.storageAccountName).toBe(existing.storageAccountName);
    expect(updated.keyVaultName).toBe(existing.keyVaultName);
    expect(updated.aiServicesName).toBe(existing.aiServicesName);
    expect(updated.hubName).toBe(existing.hubName);
    expect(updated.projectName).toBe(existing.projectName);
    expect(updated.adminUsername).toBe(existing.adminUsername);
    expect(updated.sshPublicKeyPath).toBe(existing.sshPublicKeyPath);
  });

  it("allows changing mutable fields", async () => {
    const existing = validConfig();

    mockAsk
      .mockResolvedValueOnce("westus2")          // location
      .mockResolvedValueOnce("Standard_D4s_v3")  // vmSize
      .mockResolvedValueOnce("gpt-4o-mini")      // modelName
      .mockResolvedValueOnce("2025-01-01");       // modelVersion
    mockAskNumber
      .mockResolvedValueOnce(128)                 // osDiskSizeGb
      .mockResolvedValueOnce(60);                 // modelCapacity

    const updated = await collectConfigUpdate(existing);

    expect(updated.location).toBe("westus2");
    expect(updated.vmSize).toBe("Standard_D4s_v3");
    expect(updated.osDiskSizeGb).toBe(128);
    expect(updated.modelName).toBe("gpt-4o-mini");
    expect(updated.modelVersion).toBe("2025-01-01");
    expect(updated.modelCapacity).toBe(60);

    // Immutable fields still preserved
    expect(updated.suffix).toBe(existing.suffix);
    expect(updated.resourceGroupName).toBe(existing.resourceGroupName);
    expect(updated.keyVaultName).toBe(existing.keyVaultName);
  });

  it("validates the updated config", async () => {
    const existing = validConfig();

    mockAsk
      .mockResolvedValueOnce("eastus2")           // location
      .mockResolvedValueOnce("Standard_D2s_v3")   // vmSize
      .mockResolvedValueOnce("gpt-4o")            // modelName
      .mockResolvedValueOnce("2024-11-20");        // modelVersion
    mockAskNumber
      .mockResolvedValueOnce(64)                   // osDiskSizeGb
      .mockResolvedValueOnce(30);                  // modelCapacity

    // Should not throw — valid config
    await expect(collectConfigUpdate(existing)).resolves.toBeDefined();
  });

  it("rejects invalid osDiskSizeGb from update", async () => {
    const existing = validConfig();

    mockAsk.mockImplementation((_q: string, defaultValue?: string) =>
      Promise.resolve(defaultValue ?? ""),
    );
    mockAskNumber
      .mockResolvedValueOnce(10)                   // osDiskSizeGb < 30 (invalid)
      .mockResolvedValueOnce(30);                  // modelCapacity

    await expect(collectConfigUpdate(existing)).rejects.toThrow("osDiskSizeGb");
  });
});
