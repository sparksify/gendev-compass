import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/advisor/password";

describe("password hashing", () => {
  it("verifies the correct password", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces unique salts per hash", () => {
    expect(hashPassword("same")).not.toEqual(hashPassword("same"));
  });

  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(verifyPassword("anything", "")).toBe(false);
    expect(verifyPassword("anything", "bcrypt$something$else")).toBe(false);
  });
});
