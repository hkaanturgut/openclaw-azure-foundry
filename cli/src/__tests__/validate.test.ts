import { describe, it, expect } from "vitest";
import { validateConfig } from "../validate.js";
import { validConfig } from "./fixtures.js";

describe("validateConfig", () => {
  it("accepts a valid config", () => {
    expect(() => validateConfig(validConfig())).not.toThrow();
  });

  // suffix
  describe("suffix", () => {
    it("rejects empty suffix", () => {
      expect(() => validateConfig(validConfig({ suffix: "" }))).toThrow("suffix");
    });

    it("rejects suffix longer than 20 chars", () => {
      expect(() => validateConfig(validConfig({ suffix: "a".repeat(21) }))).toThrow("suffix");
    });

    it("rejects uppercase in suffix", () => {
      expect(() => validateConfig(validConfig({ suffix: "Test" }))).toThrow("suffix must be lowercase");
    });

    it("rejects special characters in suffix", () => {
      expect(() => validateConfig(validConfig({ suffix: "test@foo" }))).toThrow("suffix must be lowercase");
    });

    it("allows dashes in suffix", () => {
      expect(() => validateConfig(validConfig({ suffix: "my-proj" }))).not.toThrow();
    });
  });

  // resourceGroupName
  describe("resourceGroupName", () => {
    it("rejects invalid characters", () => {
      expect(() => validateConfig(validConfig({ resourceGroupName: "rg@invalid!" }))).toThrow("resourceGroupName");
    });

    it("accepts valid resource group names with parens and dots", () => {
      expect(() => validateConfig(validConfig({ resourceGroupName: "rg-test.prod_(v2)" }))).not.toThrow();
    });
  });

  // vnetName
  describe("vnetName", () => {
    it("rejects single character vnet name", () => {
      expect(() => validateConfig(validConfig({ vnetName: "v" }))).toThrow("vnetName");
    });

    it("rejects invalid characters", () => {
      expect(() => validateConfig(validConfig({ vnetName: "vnet@bad" }))).toThrow("vnetName");
    });
  });

  // vmName
  describe("vmName", () => {
    it("rejects empty vm name", () => {
      expect(() => validateConfig(validConfig({ vmName: "" }))).toThrow("vmName");
    });

    it("rejects underscores in vm name", () => {
      expect(() => validateConfig(validConfig({ vmName: "vm_test" }))).toThrow("vmName");
    });
  });

  // adminUsername
  describe("adminUsername", () => {
    it("rejects username starting with a digit", () => {
      expect(() => validateConfig(validConfig({ adminUsername: "1user" }))).toThrow("adminUsername");
    });

    it("rejects uppercase in username", () => {
      expect(() => validateConfig(validConfig({ adminUsername: "Admin" }))).toThrow("adminUsername");
    });

    it("accepts underscores and dashes", () => {
      expect(() => validateConfig(validConfig({ adminUsername: "my_user-1" }))).not.toThrow();
    });
  });

  // storageAccountName
  describe("storageAccountName", () => {
    it("rejects names shorter than 3 chars", () => {
      expect(() => validateConfig(validConfig({ storageAccountName: "st" }))).toThrow("storageAccountName");
    });

    it("rejects names longer than 24 chars", () => {
      expect(() => validateConfig(validConfig({ storageAccountName: "a".repeat(25) }))).toThrow("storageAccountName");
    });

    it("rejects dashes in storage account name", () => {
      expect(() => validateConfig(validConfig({ storageAccountName: "st-test" }))).toThrow("storageAccountName must be lowercase letters and numbers");
    });

    it("rejects uppercase", () => {
      expect(() => validateConfig(validConfig({ storageAccountName: "StTest123" }))).toThrow("storageAccountName must be lowercase");
    });
  });

  // keyVaultName
  describe("keyVaultName", () => {
    it("rejects names shorter than 3 chars", () => {
      expect(() => validateConfig(validConfig({ keyVaultName: "kv" }))).toThrow("keyVaultName");
    });

    it("rejects names longer than 24 chars", () => {
      expect(() => validateConfig(validConfig({ keyVaultName: "a".repeat(25) }))).toThrow("keyVaultName");
    });

    it("rejects uppercase", () => {
      expect(() => validateConfig(validConfig({ keyVaultName: "KV-Test" }))).toThrow("keyVaultName must be lowercase");
    });
  });

  // aiServicesName
  describe("aiServicesName", () => {
    it("rejects uppercase", () => {
      expect(() => validateConfig(validConfig({ aiServicesName: "AI-Services" }))).toThrow("aiServicesName must be lowercase");
    });

    it("rejects single char", () => {
      expect(() => validateConfig(validConfig({ aiServicesName: "a" }))).toThrow("aiServicesName");
    });
  });

  // numeric fields
  describe("osDiskSizeGb", () => {
    it("rejects disk size below 30", () => {
      expect(() => validateConfig(validConfig({ osDiskSizeGb: 10 }))).toThrow("osDiskSizeGb must be between 30 and 4095");
    });

    it("rejects disk size above 4095", () => {
      expect(() => validateConfig(validConfig({ osDiskSizeGb: 5000 }))).toThrow("osDiskSizeGb must be between 30 and 4095");
    });

    it("accepts boundary values", () => {
      expect(() => validateConfig(validConfig({ osDiskSizeGb: 30 }))).not.toThrow();
      expect(() => validateConfig(validConfig({ osDiskSizeGb: 4095 }))).not.toThrow();
    });
  });

  describe("modelCapacity", () => {
    it("rejects capacity below 1", () => {
      expect(() => validateConfig(validConfig({ modelCapacity: 0 }))).toThrow("modelCapacity must be between 1 and 1000");
    });

    it("rejects capacity above 1000", () => {
      expect(() => validateConfig(validConfig({ modelCapacity: 1001 }))).toThrow("modelCapacity must be between 1 and 1000");
    });

    it("accepts boundary values", () => {
      expect(() => validateConfig(validConfig({ modelCapacity: 1 }))).not.toThrow();
      expect(() => validateConfig(validConfig({ modelCapacity: 1000 }))).not.toThrow();
    });
  });
});
