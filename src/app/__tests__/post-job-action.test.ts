import { beforeEach, describe, expect, it, vi } from "vitest";

// postJobAction with the database mocked: no Supabase needed.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({
  currentProfileId: vi.fn(async () => "hirer"),
  setCurrentProfile: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getProfile: vi.fn(),
  getJob: vi.fn(),
  getProfilesById: vi.fn(async () => new Map()),
  insertJob: vi.fn(),
  insertNegotiation: vi.fn(),
  deleteJob: vi.fn(),
  updateJobIf: vi.fn(),
  insertNotification: vi.fn(),
}));

import * as data from "@/lib/data";
import { postJobAction } from "../actions";

const d = vi.mocked(data);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
const input = { title: "Deep clean", chores: ["Cleaning"], frequency: "one_time", recurring_days: [], start_date: today, start_time: "10:00", area: "Lakeside", address: "", notes: "", budget: 1200 };
const job = { id: "job1", poster_id: "hirer", invited_helper_id: "helper", status: "open", title: "Deep clean" };

beforeEach(() => {
  vi.clearAllMocks();
  d.getProfile.mockImplementation(async (id: string) => ({ id, full_name: id, offers_help: true }) as never);
  d.insertJob.mockResolvedValue(job as never);
  d.getJob.mockResolvedValue(job as never);
});

describe("postJobAction", () => {
  it("removes the new job when its negotiation can't be saved", async () => {
    d.insertNegotiation.mockRejectedValue(new Error('null value in column "proposed_by"'));
    const r = await postJobAction(input, "helper");
    expect(r.ok).toBe(false);
    expect(d.deleteJob).toHaveBeenCalledWith("job1");
    expect(d.insertNotification).not.toHaveBeenCalled();
  });

  it("falls back to cancelling when delete fails", async () => {
    d.insertNegotiation.mockRejectedValue(new Error("boom"));
    d.deleteJob.mockRejectedValue(new Error("no delete"));
    const r = await postJobAction(input, "helper");
    expect(r).toEqual({ ok: false, error: "boom" });
    expect(d.updateJobIf).toHaveBeenCalledWith("job1", ["open"], { status: "cancelled" });
  });

  it("keeps the job and notifies both people on success; a notification failure doesn't break it", async () => {
    d.insertNegotiation.mockResolvedValue({ id: "neg1", job_id: "job1", hirer_id: "hirer", helper_id: "helper", started_by: "hirer", current_price: 1200 } as never);
    d.insertNotification.mockRejectedValue(new Error("notifications table missing"));
    const r = await postJobAction(input, "helper");
    expect(r).toEqual({ ok: true, value: { jobId: "job1", negotiationId: "neg1" } });
    expect(d.deleteJob).not.toHaveBeenCalled();
    expect(d.insertNotification.mock.calls.map((c) => [c[0].profile_id, c[0].kind])).toEqual([
      ["helper", "offer_received"],
      ["hirer", "offer_sent"],
    ]);
  });

  it("a plain open job (no invited helper) is never deleted", async () => {
    const r = await postJobAction(input, null);
    expect(r.ok).toBe(true);
    expect(d.deleteJob).not.toHaveBeenCalled();
  });
});
