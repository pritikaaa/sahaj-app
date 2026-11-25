// Product rules. PRD v0.1 left price unit / floor open — these are the
// MVP defaults (change here; the DB CHECKs in schema.sql must match).
export const PRICE_UNIT = "per visit";
export const PRICE_FLOOR = 300; // NPR
export const PRICE_CEILING = 50000; // NPR
export const NEGOTIATION_SECONDS = 60; // M1: session lapses after one minute
export const MAX_OFFERS = 6; // opening offer + up to 5 counters

export const CHORES = [
  "Cleaning",
  "Cooking",
  "Laundry",
  "Dishes",
  "Child care",
  "Elder care",
  "Gardening",
  "Grocery run",
  "Pet care",
  "Tutoring",
] as const;

export const AREAS = [
  "Lakeside",
  "Damside",
  "Mahendrapul",
  "Chipledhunga",
  "Prithvi Chowk",
  "Bagar",
  "Lamachaur",
  "Hemja",
  "Birauta",
  "Srijana Chowk",
  "Newroad",
  "Other",
] as const;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Nepal Police emergency number, shown on every SOS confirmation.
export const POLICE_NUMBER = "100";
