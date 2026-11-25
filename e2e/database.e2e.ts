// Checks supabase/schema.sql rules through the real supabase-js client and
// the anon key: constraints, the one-minute trigger, anon policies.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const sb = createClient(url, key, { auth: { persistSession: false } });
const tag = `e2e-${Date.now()}`;
const ids: { profiles: string[] } = { profiles: [] };

async function person(name: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await sb.from("profiles").insert({ full_name: `${name} ${tag}`, ...extra }).select("*").single();
  if (error) throw error;
  ids.profiles.push(data.id);
  return data;
}

let hirer: { id: string }, helper: { id: string }, job: { id: string };

beforeAll(async () => {
  hirer = await person("Hirer");
  helper = await person("Helper", { offers_help: true, chores: ["Cleaning"], is_student: true });
  const { data, error } = await sb
    .from("jobs")
    .insert({ poster_id: hirer.id, title: "E2E", chores: ["Cleaning", "Cooking"], frequency: "weekly", recurring_days: ["Mon", "Thu"], start_date: "2030-01-06", area: "Lakeside", budget: 800 })
    .select("*")
    .single();
  if (error) throw error;
  job = data;
});

afterAll(async () => {
  if (ids.profiles.length) await sb.from("profiles").delete().in("id", ids.profiles);
});

describe("schema rules via anon key", () => {
  it("stores multi-chore recurring jobs (M5)", async () => {
    const { data } = await sb.from("jobs").select("*").eq("id", job.id).single();
    expect(data.chores).toEqual(["Cleaning", "Cooking"]);
    expect(data.recurring_days).toEqual(["Mon", "Thu"]);
    expect(data.status).toBe("open");
  });

  it("rejects prices below the NPR 300 floor and jobs with no chores", async () => {
    const low = await sb.from("jobs").insert({ poster_id: hirer.id, chores: ["Cleaning"], start_date: "2030-01-01", budget: 100 });
    expect(low.error?.message).toMatch(/check constraint/);
    const none = await sb.from("jobs").insert({ poster_id: hirer.id, chores: [], start_date: "2030-01-01", budget: 500 });
    expect(none.error?.message).toMatch(/check constraint/);
  });

  it("allows only one live negotiation per job + helper", async () => {
    const row = {
      job_id: job.id, hirer_id: hirer.id, helper_id: helper.id, started_by: helper.id, current_price: 900,
      last_offer_by: helper.id, history: [{ by: helper.id, action: "offer", price: 900, at: new Date().toISOString() }],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const first = await sb.from("negotiations").insert(row).select("*").single();
    expect(first.error).toBeNull();
    expect(first.data.history[0].price).toBe(900);
    const second = await sb.from("negotiations").insert(row);
    expect(second.error?.message).toMatch(/negotiations_one_active_idx|duplicate key/);
    await sb.from("negotiations").update({ status: "declined" }).eq("id", first.data.id);
  });

  it("database clock blocks accepting after one minute, but allows expiring", async () => {
    const { data: n } = await sb
      .from("negotiations")
      .insert({ job_id: job.id, hirer_id: hirer.id, helper_id: helper.id, started_by: helper.id, current_price: 700, last_offer_by: helper.id, expires_at: new Date(Date.now() - 1000).toISOString() })
      .select("*")
      .single();
    const accept = await sb.from("negotiations").update({ status: "accepted" }).eq("id", n.id).select("*");
    expect(accept.error?.message).toMatch(/negotiation expired/);
    const counter = await sb.from("negotiations").update({ current_price: 650 }).eq("id", n.id).select("*");
    expect(counter.error?.message).toMatch(/negotiation expired/);
    const expire = await sb.from("negotiations").update({ status: "expired" }).eq("id", n.id).select("*").single();
    expect(expire.data.status).toBe("expired");
    const reopen = await sb.from("negotiations").update({ status: "active" }).eq("id", n.id);
    expect(reopen.error?.message).toMatch(/already expired/);
  });

  it("records SOS events with location (M4)", async () => {
    const { data, error } = await sb
      .from("sos_events")
      .insert({ job_id: job.id, raised_by: helper.id, latitude: 28.2096, longitude: 83.9856, contact_phone: "9800000000" })
      .select("*")
      .single();
    expect(error).toBeNull();
    expect(data.status).toBe("open");
    expect(data.latitude).toBeCloseTo(28.2096);
  });

  it("rejects unknown verification states", async () => {
    const bad = await sb.from("profiles").update({ verification_status: "approved" }).eq("id", helper.id);
    expect(bad.error?.message).toMatch(/check constraint/);
  });
});
