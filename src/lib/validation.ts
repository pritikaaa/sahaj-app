import { AREAS, CHORES, PRICE_CEILING, PRICE_FLOOR, WEEKDAYS } from "./constants";
import type { Frequency, Result, VerificationType } from "./types";

const fail = (error: string) => ({ ok: false as const, error });
const ok = <T>(value: T) => ({ ok: true as const, value });
const clean = (s: unknown) => (typeof s === "string" ? s.trim() : "");
const orNull = (s: unknown) => clean(s) || null;

export function validatePrice(price: number): string | null {
  if (!Number.isInteger(price)) return "Price must be a whole number of rupees.";
  if (price < PRICE_FLOOR) return `Minimum price is NPR ${PRICE_FLOOR.toLocaleString("en-US")} per visit.`;
  if (price > PRICE_CEILING) return `Maximum price is NPR ${PRICE_CEILING.toLocaleString("en-US")} per visit.`;
  return null;
}

export function parsePrice(input: unknown): Result<number> {
  const s = String(input ?? "").replace(/[,\s]/g, "").replace(/^(npr|rs\.?)/i, "");
  if (!/^\d+$/.test(s)) return fail("Enter a price in whole rupees, e.g. 800.");
  const n = Number(s);
  const err = validatePrice(n);
  return err ? fail(err) : ok(n);
}

const PHONE = /^(\+?977)?9\d{9}$/;
function normalisePhone(raw: unknown): Result<string | null> {
  const s = clean(raw).replace(/[\s-]/g, "");
  if (!s) return ok(null);
  if (!PHONE.test(s)) return fail("Phone must be a Nepali mobile number like 98XXXXXXXX.");
  return ok(s.replace(/^\+?977/, ""));
}

export interface JobInput {
  title: string;
  chores: string[];
  frequency: Frequency;
  recurring_days: string[];
  start_date: string;
  start_time: string | null;
  area: string;
  address: string | null;
  notes: string | null;
  budget: number;
}

export function validateJobInput(raw: Record<string, unknown>, today: string): Result<JobInput> {
  const chores = Array.isArray(raw.chores) ? (raw.chores as string[]) : [];
  if (chores.length === 0) return fail("Pick at least one chore.");
  if (!chores.every((c) => (CHORES as readonly string[]).includes(c))) return fail("Unknown chore selected.");

  const frequency = raw.frequency as Frequency;
  if (!["one_time", "daily", "weekly"].includes(frequency)) return fail("Choose one-time, daily or weekly.");
  let days = Array.isArray(raw.recurring_days) ? (raw.recurring_days as string[]) : [];
  if (frequency === "weekly") {
    if (days.length === 0) return fail("Pick the days for a weekly booking.");
    if (!days.every((d) => (WEEKDAYS as readonly string[]).includes(d))) return fail("Unknown weekday.");
    days = WEEKDAYS.filter((d) => days.includes(d));
  } else {
    days = [];
  }

  const start_date = clean(raw.start_date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || Number.isNaN(Date.parse(start_date))) {
    return fail("Pick a start date.");
  }
  if (start_date < today) return fail("Start date can't be in the past.");
  const start_time = clean(raw.start_time) || null;
  if (start_time && !/^\d{2}:\d{2}(:\d{2})?$/.test(start_time)) return fail("Pick a valid time.");

  const area = clean(raw.area);
  if (!area || !(AREAS as readonly string[]).includes(area)) return fail("Pick an area in Pokhara.");

  const budget = parsePrice(raw.budget);
  if (!budget.ok) return budget;

  return ok({
    title: clean(raw.title).slice(0, 80) || chores.join(" + "),
    chores,
    frequency,
    recurring_days: days,
    start_date,
    start_time,
    area,
    address: orNull(raw.address),
    notes: orNull(raw.notes)?.slice(0, 500) ?? null,
    budget: budget.value,
  });
}

export interface ProfileInput {
  full_name: string;
  phone: string | null;
  area: string | null;
  bio: string | null;
  offers_help: boolean;
  chores: string[];
  min_price: number | null;
  is_student: boolean;
  trusted_contact_name: string | null;
  trusted_contact_phone: string | null;
}

export function validateProfileInput(raw: Record<string, unknown>): Result<ProfileInput> {
  const full_name = clean(raw.full_name);
  if (full_name.length < 2 || full_name.length > 80) return fail("Enter your full name.");
  const phone = normalisePhone(raw.phone);
  if (!phone.ok) return phone;
  const contactPhone = normalisePhone(raw.trusted_contact_phone);
  if (!contactPhone.ok) return fail("Trusted contact phone must be a Nepali mobile number like 98XXXXXXXX.");

  const offers_help = raw.offers_help === true || raw.offers_help === "on" || raw.offers_help === "true";
  const chores = Array.isArray(raw.chores) ? (raw.chores as string[]) : [];
  if (!chores.every((c) => (CHORES as readonly string[]).includes(c))) return fail("Unknown chore selected.");
  if (offers_help && chores.length === 0) return fail("Pick the chores you can do.");

  let min_price: number | null = null;
  if (clean(raw.min_price)) {
    const p = parsePrice(raw.min_price);
    if (!p.ok) return p;
    min_price = p.value;
  }
  const area = clean(raw.area);
  if (area && !(AREAS as readonly string[]).includes(area)) return fail("Pick an area in Pokhara.");

  return ok({
    full_name,
    phone: phone.value,
    area: area || null,
    bio: orNull(raw.bio)?.slice(0, 400) ?? null,
    offers_help,
    chores: offers_help ? chores : [],
    min_price: offers_help ? min_price : null,
    is_student: raw.is_student === true || raw.is_student === "on" || raw.is_student === "true",
    trusted_contact_name: orNull(raw.trusted_contact_name),
    trusted_contact_phone: contactPhone.value,
  });
}

export interface VerificationInput {
  is_student: boolean;
  verification_type: VerificationType;
  verification_number: string;
  verification_issuer: string;
}

export function validateVerification(raw: {
  is_student: boolean;
  verification_type: unknown;
  verification_number: unknown;
  verification_issuer: unknown;
}): Result<VerificationInput> {
  const type = raw.verification_type;
  if (type !== "student_id" && type !== "government_id") return fail("Choose an ID type.");
  if (raw.is_student && type !== "student_id") return fail("Students verify with a student ID card.");
  if (!raw.is_student && type !== "government_id") {
    return fail("Adults verify with a government ID (citizenship, licence or passport).");
  }
  const number = clean(raw.verification_number);
  if (!/^[A-Za-z0-9/\-. ]{4,30}$/.test(number)) return fail("Enter the ID number exactly as printed (4–30 characters).");
  const issuer = clean(raw.verification_issuer);
  if (issuer.length < 3) {
    return fail(type === "student_id" ? "Enter your college or school name." : "Enter the issuing office (e.g. DAO Kaski).");
  }
  return ok({ is_student: raw.is_student, verification_type: type, verification_number: number, verification_issuer: issuer });
}
