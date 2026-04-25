import { describe, it, expect } from "vitest";
import { renderParams } from "../params.js";
import { validConfig } from "./fixtures.js";

describe("renderParams", () => {
  it("returns valid JSON with ARM parameter schema", () => {
    const result = JSON.parse(renderParams(validConfig()));
    expect(result.$schema).toBe(
      "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#"
    );
    expect(result.contentVersion).toBe("1.0.0.0");
  });

  it("includes all expected parameters", () => {
    const result = JSON.parse(renderParams(validConfig()));
    const paramNames = Object.keys(result.parameters);
    expect(paramNames).toContain("location");
    expect(paramNames).toContain("resourceGroupName");
    expect(paramNames).toContain("vnetName");
    expect(paramNames).toContain("vmName");
    expect(paramNames).toContain("vmSize");
    expect(paramNames).toContain("osDiskSizeGb");
    expect(paramNames).toContain("adminUsername");
    expect(paramNames).toContain("aiServicesName");
    expect(paramNames).toContain("hubName");
    expect(paramNames).toContain("projectName");
    expect(paramNames).toContain("storageAccountName");
    expect(paramNames).toContain("modelName");
    expect(paramNames).toContain("modelVersion");
    expect(paramNames).toContain("modelCapacity");
    expect(paramNames).toContain("keyVaultName");
  });

  it("does not include sshPublicKeyPath in parameters", () => {
    const result = JSON.parse(renderParams(validConfig()));
    expect(Object.keys(result.parameters)).not.toContain("sshPublicKeyPath");
  });

  it("wraps each value in { value: ... } format", () => {
    const config = validConfig();
    const result = JSON.parse(renderParams(config));
    expect(result.parameters.location).toEqual({ value: "eastus2" });
    expect(result.parameters.osDiskSizeGb).toEqual({ value: 64 });
  });

  it("uses config values correctly", () => {
    const config = validConfig({ suffix: "prod", location: "westus", vmSize: "Standard_D4s_v3" });
    const result = JSON.parse(renderParams(config));
    expect(result.parameters.location.value).toBe("westus");
    expect(result.parameters.vmSize.value).toBe("Standard_D4s_v3");
  });

  it("produces well-formatted JSON string", () => {
    const output = renderParams(validConfig());
    // Should be pretty-printed with 2-space indent
    expect(output).toContain("\n");
    expect(output.startsWith("{")).toBe(true);
  });
});
