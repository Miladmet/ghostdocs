import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { CONTENT_SECURITY_POLICY } from "../../lib/csp";

const EXPECTED =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'self';";

describe("CONTENT_SECURITY_POLICY", () => {
  it("equals the exact expected policy string", () => {
    expect(CONTENT_SECURITY_POLICY).toBe(EXPECTED);
  });

  it("restricts connect-src to self and mentions no external hosts", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'self';");
    expect(CONTENT_SECURITY_POLICY.toLowerCase()).not.toContain("huggingface");
    expect(CONTENT_SECURITY_POLICY).not.toContain("https://");
  });

  it("matches the Content-Security-Policy line in public/_headers", () => {
    const headers = fs.readFileSync(
      path.resolve(__dirname, "../../public/_headers"),
      "utf8"
    );
    const line = headers
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith("Content-Security-Policy:"));
    expect(line).toBeDefined();
    expect(line!.trim().slice("Content-Security-Policy:".length).trim()).toBe(
      CONTENT_SECURITY_POLICY
    );
  });
});
