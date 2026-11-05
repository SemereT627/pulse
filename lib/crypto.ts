import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for GitHub tokens and AI keys at rest. Stored as "v1:<iv>:<tag>:<ciphertext>", base64 parts.

function key() {
  const raw = process.env.ENCRYPTION_KEY;
  const buf = raw ? Buffer.from(raw, "base64") : null;
  if (!buf || buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64 (openssl rand -base64 32).");
  return buf;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64"))).join(":");
}

export function decrypt(stored: string): string {
  const [v, iv, tag, data] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

/** What the UI may show of a secret. */
export const lastFour = (secret: string) => `•••• ${secret.slice(-4)}`;
