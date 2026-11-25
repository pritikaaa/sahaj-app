import { describe, expect, it } from "vitest";
import { toPublic } from "../public-profile";
import type { Profile } from "../types";

describe("toPublic", () => {
  it("never exposes ID numbers or trusted contacts", () => {
    const p = {
      id: "1", full_name: "Asha", verification_number: "PU-1", verification_issuer: "PN Campus",
      trusted_contact_name: "Mum", trusted_contact_phone: "9800000000",
    } as Profile;
    const pub = toPublic(p) as Record<string, unknown>;
    expect(pub.full_name).toBe("Asha");
    for (const k of ["verification_number", "verification_issuer", "trusted_contact_name", "trusted_contact_phone"]) {
      expect(k in pub).toBe(false);
    }
  });
});
