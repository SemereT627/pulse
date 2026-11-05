import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";

describe("crypto", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });

  it("round-trips and uses a fresh iv each time", () => {
    const a = encrypt("ghp_secret");
    expect(decrypt(a)).toBe("ghp_secret");
    expect(encrypt("ghp_secret")).not.toBe(a);
  });

  it("rejects tampered ciphertext", () => {
    const parts = encrypt("ghp_secret").split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("fails loudly without a key", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
  });
});
