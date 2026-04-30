import { describe, expect, it } from "vitest";
import { computeVisitorFingerprint, dailySaltFor } from "../../fingerprint";

describe("dailySaltFor", () => {
  it("returns the same salt for the same UTC day", async () => {
    const day = new Date("2026-04-22T10:00:00Z");
    const s1 = await dailySaltFor(day, "secret");
    const s2 = await dailySaltFor(new Date("2026-04-22T23:59:59Z"), "secret");
    expect(s1).toBe(s2);
  });

  it("returns different salts on different UTC days", async () => {
    const s1 = await dailySaltFor(new Date("2026-04-22T10:00:00Z"), "secret");
    const s2 = await dailySaltFor(new Date("2026-04-23T10:00:00Z"), "secret");
    expect(s1).not.toBe(s2);
  });

  it("returns different salts for different secrets", async () => {
    const day = new Date("2026-04-22T10:00:00Z");
    const s1 = await dailySaltFor(day, "secret-a");
    const s2 = await dailySaltFor(day, "secret-b");
    expect(s1).not.toBe(s2);
  });

  it("falls back gracefully when secret is undefined", async () => {
    const s = await dailySaltFor(new Date("2026-04-22T10:00:00Z"), undefined);
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });
});

describe("computeVisitorFingerprint", () => {
  const now = new Date("2026-04-22T10:00:00Z");

  it("is deterministic for the same visitor within a day", async () => {
    const fp1 = await computeVisitorFingerprint("1.2.3.4", "Mozilla/5.0", "secret", now);
    const fp2 = await computeVisitorFingerprint("1.2.3.4", "Mozilla/5.0", "secret", now);
    expect(fp1).toBe(fp2);
  });

  it("differs between different IPs", async () => {
    const a = await computeVisitorFingerprint("1.2.3.4", "Mozilla/5.0", "secret", now);
    const b = await computeVisitorFingerprint("5.6.7.8", "Mozilla/5.0", "secret", now);
    expect(a).not.toBe(b);
  });

  it("differs between different user agents", async () => {
    const a = await computeVisitorFingerprint("1.2.3.4", "Mozilla/5.0", "secret", now);
    const b = await computeVisitorFingerprint("1.2.3.4", "curl/8.0", "secret", now);
    expect(a).not.toBe(b);
  });

  it("rotates across days for the same visitor", async () => {
    const day1 = await computeVisitorFingerprint("1.2.3.4", "Mozilla/5.0", "secret", new Date("2026-04-22T10:00:00Z"));
    const day2 = await computeVisitorFingerprint("1.2.3.4", "Mozilla/5.0", "secret", new Date("2026-04-23T10:00:00Z"));
    expect(day1).not.toBe(day2);
  });

  it("returns null when IP and UA are both empty", async () => {
    const fp = await computeVisitorFingerprint(null, null, "secret", now);
    expect(fp).toBeNull();
  });

  it("still fingerprints with only one of IP/UA", async () => {
    const fp = await computeVisitorFingerprint("1.2.3.4", null, "secret", now);
    expect(fp).not.toBeNull();
    expect(typeof fp).toBe("string");
  });

  it("produces a fixed-length hex string", async () => {
    const fp = await computeVisitorFingerprint("1.2.3.4", "Mozilla/5.0", "secret", now);
    expect(fp).toMatch(/^[0-9a-f]+$/);
    expect(fp!.length).toBe(64); // SHA-256 hex
  });
});
