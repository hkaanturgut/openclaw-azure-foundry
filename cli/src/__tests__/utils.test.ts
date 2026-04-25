import { describe, it, expect } from "vitest";
import { expandTilde } from "../utils.js";
import os from "node:os";
import path from "node:path";

describe("expandTilde", () => {
  it("expands bare ~ to home directory", () => {
    expect(expandTilde("~")).toBe(os.homedir());
  });

  it("expands ~/ prefix to home directory", () => {
    expect(expandTilde("~/.ssh/id_ed25519.pub")).toBe(
      path.join(os.homedir(), ".ssh", "id_ed25519.pub")
    );
  });

  it("does not expand ~ in the middle of a path", () => {
    expect(expandTilde("/home/user/~file")).toBe("/home/user/~file");
  });

  it("returns absolute paths unchanged", () => {
    expect(expandTilde("/tmp/key.pub")).toBe("/tmp/key.pub");
  });

  it("returns relative paths unchanged", () => {
    expect(expandTilde("keys/id.pub")).toBe("keys/id.pub");
  });
});
