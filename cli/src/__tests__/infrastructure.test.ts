/**
 * Infrastructure file regression tests.
 *
 * These tests read the bundled Bicep modules and cloud-init YAML that the CLI
 * ships inside the npm package and assert the presence of security-critical
 * properties. They act as a lint/regression layer that runs without an Azure
 * subscription, catching accidental regressions in the bundled infra files.
 */

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { getPackageDir } from "../utils.js";

let infraDir: string;
let cloudInitYaml: string;
let networkingBicep: string;
let computeBicep: string;
let mainBicep: string;

beforeAll(async () => {
  infraDir = path.join(getPackageDir(), "infrastructure");
  [cloudInitYaml, networkingBicep, computeBicep, mainBicep] = await Promise.all([
    fs.readFile(path.join(infraDir, "cloud-init", "cloud-init.yaml"), "utf8"),
    fs.readFile(path.join(infraDir, "modules", "networking.bicep"), "utf8"),
    fs.readFile(path.join(infraDir, "modules", "compute.bicep"), "utf8"),
    fs.readFile(path.join(infraDir, "main.bicep"), "utf8"),
  ]);
});

// ─── cloud-init.yaml ────────────────────────────────────────────────────────

describe("cloud-init.yaml — supply chain trust", () => {
  it("does not use the NodeSource curl|bash bootstrap script", () => {
    // Before the fix, the dangerous pattern was:
    //   curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    expect(cloudInitYaml).not.toContain("setup_lts.x");
    expect(cloudInitYaml).not.toMatch(/nodesource\.com\/setup.*\|\s*bash/);
  });

  it("does not use the Microsoft curl|bash Azure CLI installer", () => {
    // Before the fix, the dangerous pattern was:
    //   curl -sL https://aka.ms/InstallAzureCLIDeb | bash
    expect(cloudInitYaml).not.toContain("InstallAzureCLIDeb");
    expect(cloudInitYaml).not.toMatch(/aka\.ms\/.*\|\s*bash/);
  });

  it("uses GPG dearmoring for Node.js apt key", () => {
    expect(cloudInitYaml).toContain("nodesource-repo.gpg.key");
    expect(cloudInitYaml).toContain("gpg --dearmor");
    expect(cloudInitYaml).toContain("signed-by=/usr/share/keyrings/nodesource.gpg");
  });

  it("uses GPG dearmoring for Azure CLI apt key", () => {
    expect(cloudInitYaml).toContain("packages.microsoft.com/keys/microsoft.asc");
    expect(cloudInitYaml).toContain("signed-by=/usr/share/keyrings/microsoft.gpg");
  });

  it("installs Node.js via apt (not setup script)", () => {
    expect(cloudInitYaml).toContain("apt-get install -y nodejs");
    expect(cloudInitYaml).not.toContain("setup_lts.x");
    expect(cloudInitYaml).not.toContain("InstallAzureCLIDeb");
  });
});

describe("cloud-init.yaml — credential file permissions", () => {
  it("applies chmod 600 to openclaw.json", () => {
    expect(cloudInitYaml).toContain("chmod 600 /home/${ADMIN_USERNAME}/.openclaw/openclaw.json");
  });

  it("applies chmod 600 to auth-profiles.json", () => {
    expect(cloudInitYaml).toContain("chmod 600 /home/${ADMIN_USERNAME}/.openclaw/agents/main/agent/auth-profiles.json");
  });

  it("applies chmod 700 to all .openclaw directories", () => {
    expect(cloudInitYaml).toContain("chmod 700 /home/${ADMIN_USERNAME}/.openclaw");
    expect(cloudInitYaml).toContain("chmod 700 /home/${ADMIN_USERNAME}/.openclaw/agents");
    expect(cloudInitYaml).toContain("chmod 700 /home/${ADMIN_USERNAME}/.openclaw/agents/main");
    expect(cloudInitYaml).toContain("chmod 700 /home/${ADMIN_USERNAME}/.openclaw/agents/main/agent");
  });

  it("sets ownership before restricting permissions", () => {
    const chownIdx = cloudInitYaml.indexOf("chown -R ${ADMIN_USERNAME}");
    const chmodIdx = cloudInitYaml.indexOf("chmod 700 /home/${ADMIN_USERNAME}/.openclaw\n");
    expect(chownIdx).toBeGreaterThanOrEqual(0);
    expect(chmodIdx).toBeGreaterThan(chownIdx);
  });
});

// ─── networking.bicep ────────────────────────────────────────────────────────

describe("networking.bicep — outbound NSG restrictions", () => {
  it("has a DenyAllOutbound catch-all rule", () => {
    expect(networkingBicep).toContain("DenyAllOutbound");
    expect(networkingBicep).toContain("priority: 4000");
  });

  it("explicitly allows outbound AAD traffic", () => {
    expect(networkingBicep).toContain("AllowAADOutbound");
    expect(networkingBicep).toContain("AzureActiveDirectory");
  });

  it("explicitly allows outbound Key Vault traffic", () => {
    expect(networkingBicep).toContain("AllowKeyVaultOutbound");
    expect(networkingBicep).toContain("AzureKeyVault");
  });

  it("explicitly allows outbound Cognitive Services traffic", () => {
    expect(networkingBicep).toContain("AllowCognitiveServicesOutbound");
    expect(networkingBicep).toContain("CognitiveServicesManagement");
  });

  it("explicitly allows HTTPS (443) outbound to Internet", () => {
    expect(networkingBicep).toContain("AllowHttpsInternetOutbound");
    expect(networkingBicep).toContain("destinationPortRange: '443'");
  });

  it("explicitly allows DNS (UDP 53) outbound", () => {
    expect(networkingBicep).toContain("AllowDnsOutbound");
    expect(networkingBicep).toContain("protocol: 'Udp'");
    expect(networkingBicep).toContain("destinationPortRange: '53'");
  });

  it("catch-all deny rule has lower priority number than all allow rules", () => {
    // Priority 4000 (deny) must be numerically higher than all allow rule priorities
    const allowPriorities = [1000, 1010, 1020, 1030, 1040, 1050, 1060, 1070];
    allowPriorities.forEach((p) => {
      expect(networkingBicep).toContain(`priority: ${p}`);
    });
    // NSG rules: lower number = higher precedence; 4000 is lower precedence than 1xxx
    expect(4000).toBeGreaterThan(Math.max(...allowPriorities));
  });

  it("does not retain NAT Gateway resources (replaced by outbound NSG rules)", () => {
    expect(networkingBicep).not.toContain("natGateway");
    expect(networkingBicep).not.toContain("NatGateway");
  });
});

// ─── compute.bicep ────────────────────────────────────────────────────────────

describe("compute.bicep — host-level disk encryption", () => {
  it("enables encryptionAtHost", () => {
    expect(computeBicep).toContain("encryptionAtHost: true");
  });

  it("uses ZRS (zone-redundant) disk storage", () => {
    expect(computeBicep).toContain("StandardSSD_ZRS");
    expect(computeBicep).not.toContain("StandardSSD_LRS");
  });
});

describe("compute.bicep — availability zone pinning", () => {
  it("accepts an availabilityZone parameter", () => {
    expect(computeBicep).toContain("param availabilityZone string");
  });

  it("pins the VM to the specified zone", () => {
    expect(computeBicep).toContain("zones: [availabilityZone]");
  });

  it("restricts zone parameter to valid values", () => {
    expect(computeBicep).toContain("@allowed(['1', '2', '3'])");
  });
});

// ─── main.bicep ───────────────────────────────────────────────────────────────

describe("main.bicep — parameter propagation", () => {
  it("exposes availabilityZone as a top-level parameter", () => {
    expect(mainBicep).toContain("param availabilityZone string");
  });

  it("passes availabilityZone to the compute module", () => {
    expect(mainBicep).toContain("availabilityZone: availabilityZone");
  });
});
