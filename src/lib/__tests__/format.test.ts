import { describe, expect, it } from "vitest";
import { describeSchedule, formatNPR, verificationLabel } from "../format";

describe("format", () => {
  it("formats rupees", () => {
    expect(formatNPR(1200)).toBe("NPR 1,200");
    expect(formatNPR(null)).toBe("—");
  });
  it("describes one-time and recurring schedules", () => {
    expect(describeSchedule({ frequency: "one_time", recurring_days: [], start_date: "2026-11-25", start_time: "09:30:00" }))
      .toBe("One-time · Wed 25 Nov 2026 at 9:30 AM");
    expect(describeSchedule({ frequency: "weekly", recurring_days: ["Mon", "Thu"], start_date: "2026-11-30", start_time: null }))
      .toBe("Weekly on Mon, Thu · from Mon 30 Nov 2026");
    expect(describeSchedule({ frequency: "daily", recurring_days: [], start_date: "2026-11-30", start_time: "17:00" }))
      .toBe("Daily · from Mon 30 Nov 2026 at 5:00 PM");
  });
  it("labels verification", () => {
    expect(verificationLabel({ verification_status: "verified", verification_type: "student_id" })).toBe("Verified student");
    expect(verificationLabel({ verification_status: "verified", verification_type: "government_id" })).toBe("ID verified");
    expect(verificationLabel({ verification_status: "pending", verification_type: "student_id" })).toBe("Verification pending");
    expect(verificationLabel({ verification_status: "unverified", verification_type: null })).toBe("Not verified");
  });
});
