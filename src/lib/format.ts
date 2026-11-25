import type { Frequency, Profile } from "./types";

export function formatNPR(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `NPR ${n.toLocaleString("en-US")}`;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const wd = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const rest = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${wd} ${rest}`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function describeSchedule(j: {
  frequency: Frequency;
  recurring_days: string[];
  start_date: string;
  start_time: string | null;
}): string {
  const time = j.start_time ? ` at ${formatTime(j.start_time)}` : "";
  const date = formatDate(j.start_date);
  if (j.frequency === "one_time") return `One-time · ${date}${time}`;
  if (j.frequency === "daily") return `Daily · from ${date}${time}`;
  return `Weekly on ${j.recurring_days.join(", ")} · from ${date}${time}`;
}

export function verificationLabel(p: Pick<Profile, "verification_status" | "verification_type">): string {
  switch (p.verification_status) {
    case "verified":
      return p.verification_type === "student_id" ? "Verified student" : "ID verified";
    case "pending":
      return "Verification pending";
    case "rejected":
      return "Verification rejected";
    default:
      return "Not verified";
  }
}

export function timeAgo(iso: string, now = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
