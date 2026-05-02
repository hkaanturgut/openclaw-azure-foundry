#!/usr/bin/env node

import("../dist/cli.js").catch((err) => {
  console.error("Failed to load copilot-receipts CLI:", err);
  process.exit(1);
});
