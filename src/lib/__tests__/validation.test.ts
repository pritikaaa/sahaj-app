import { describe, expect, it } from "vitest";
import { parsePrice, validateJobInput, validateProfileInput, validateVerification } from "../validation";

const TODAY = "2026-11-24";

describe("parsePrice", () => {
  it("accepts whole rupees within limits", () => {
    expect(parsePrice("1,200")).toEqual({ ok: true, value: 1200 });
    expect(parsePrice("300")).toEqual({ ok: true, value: 300 });
  });
  it("rejects bad input", () => {
    expect(parsePrice("").ok).toBe(false);
    expect(parsePrice("abc").ok).toBe(false);
    expect(parsePrice("250.5").ok).toBe(false);
    expect(parsePrice("299")).toEqual({ ok: false, error: "Minimum price is NPR 300 per visit." });
    expect(parsePrice("60000")).toEqual({ ok: false, error: "Maximum price is NPR 50,000 per visit." });
  });
});

describe("validateJobInput", () => {
  const base = {
    title: "", chores: ["Cleaning", "Cooking"], frequency: "one_time", recurring_days: [],
    start_date: "2026-11-25", start_time: "09:00", area: "Lakeside", address: "", notes: "", budget: "900",
  };
  it("accepts a multi-chore one-time booking and fills a title", () => {
    const r = validateJobInput(base, TODAY);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("Cleaning + Cooking");
      expect(r.value.budget).toBe(900);
      expect(r.value.recurring_days).toEqual([]);
      expect(r.value.address).toBeNull();
    }
  });
  it("needs at least one known chore", () => {
    expect(validateJobInput({ ...base, chores: [] }, TODAY)).toEqual({ ok: false, error: "Pick at least one chore." });
    expect(validateJobInput({ ...base, chores: ["Juggling"] }, TODAY).ok).toBe(false);
  });
  it("weekly bookings need days; one-time bookings drop them", () => {
    expect(validateJobInput({ ...base, frequency: "weekly" }, TODAY)).toEqual({ ok: false, error: "Pick the days for a weekly booking." });
    const w = validateJobInput({ ...base, frequency: "weekly", recurring_days: ["Mon", "Thu"] }, TODAY);
    expect(w.ok && w.value.recurring_days).toEqual(["Mon", "Thu"]);
    const o = validateJobInput({ ...base, recurring_days: ["Mon"] }, TODAY);
    expect(o.ok && o.value.recurring_days).toEqual([]);
  });
  it("rejects past dates, missing area and bad budget", () => {
    expect(validateJobInput({ ...base, start_date: "2026-11-23" }, TODAY)).toEqual({ ok: false, error: "Start date can't be in the past." });
    expect(validateJobInput({ ...base, start_date: "soon" }, TODAY).ok).toBe(false);
    expect(validateJobInput({ ...base, area: "" }, TODAY)).toEqual({ ok: false, error: "Pick an area in Pokhara." });
    expect(validateJobInput({ ...base, budget: "100" }, TODAY).ok).toBe(false);
    expect(validateJobInput({ ...base, frequency: "monthly" }, TODAY).ok).toBe(false);
  });
});

describe("validateProfileInput", () => {
  const base = {
    full_name: "Sita Gurung", phone: "9846000000", area: "Lakeside", bio: "", offers_help: false,
    chores: [], min_price: "", is_student: false, trusted_contact_name: "", trusted_contact_phone: "",
  };
  it("accepts a hirer-only profile", () => {
    const r = validateProfileInput(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.min_price).toBeNull();
  });
  it("same person can also offer help, but must pick chores", () => {
    expect(validateProfileInput({ ...base, offers_help: true })).toEqual({ ok: false, error: "Pick the chores you can do." });
    const r = validateProfileInput({ ...base, offers_help: true, chores: ["Cooking"], min_price: "500" });
    expect(r.ok && r.value.min_price).toBe(500);
  });
  it("checks name and Nepali phone numbers", () => {
    expect(validateProfileInput({ ...base, full_name: " " }).ok).toBe(false);
    expect(validateProfileInput({ ...base, phone: "12345" })).toEqual({ ok: false, error: "Phone must be a Nepali mobile number like 98XXXXXXXX." });
    expect(validateProfileInput({ ...base, phone: "+977 984-600-0000" }).ok).toBe(true);
    expect(validateProfileInput({ ...base, trusted_contact_phone: "555" }).ok).toBe(false);
  });
});

describe("validateVerification", () => {
  it("students verify with a student ID, adults with a government ID", () => {
    expect(validateVerification({ is_student: true, verification_type: "student_id", verification_number: "PU-2023-118", verification_issuer: "Prithvi Narayan Campus" }).ok).toBe(true);
    expect(validateVerification({ is_student: true, verification_type: "government_id", verification_number: "12-34-56", verification_issuer: "Kaski DAO" })).toEqual({ ok: false, error: "Students verify with a student ID card." });
    expect(validateVerification({ is_student: false, verification_type: "student_id", verification_number: "PU-1", verification_issuer: "PN Campus" })).toEqual({ ok: false, error: "Adults verify with a government ID (citizenship, licence or passport)." });
    expect(validateVerification({ is_student: false, verification_type: "government_id", verification_number: "12", verification_issuer: "Kaski" }).ok).toBe(false);
  });
});
