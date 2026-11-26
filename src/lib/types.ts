// Row types — mirror supabase/schema.sql exactly. Update both together.

export type VerificationType = "student_id" | "government_id";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface Profile {
  id: string;
  created_at: string;
  full_name: string;
  phone: string | null;
  area: string | null;
  bio: string | null;
  offers_help: boolean;
  chores: string[];
  min_price: number | null;
  is_student: boolean;
  verification_type: VerificationType | null;
  verification_number: string | null;
  verification_issuer: string | null;
  verification_status: VerificationStatus;
  verification_submitted_at: string | null;
  trusted_contact_name: string | null;
  trusted_contact_phone: string | null;
}

export type Frequency = "one_time" | "daily" | "weekly";
export type JobStatus = "open" | "booked" | "in_progress" | "completed" | "cancelled";

export interface Job {
  id: string;
  created_at: string;
  poster_id: string;
  invited_helper_id: string | null;
  helper_id: string | null;
  title: string;
  chores: string[];
  frequency: Frequency;
  recurring_days: string[];
  start_date: string;
  start_time: string | null;
  area: string | null;
  address: string | null;
  notes: string | null;
  budget: number | null;
  agreed_price: number | null;
  status: JobStatus;
  booked_at: string | null;
}

export type NegotiationStatus = "active" | "accepted" | "declined" | "expired";

export interface OfferEvent {
  by: string;
  action: "offer" | "counter" | "accept" | "decline";
  price: number;
  at: string;
}

export interface Negotiation {
  id: string;
  created_at: string;
  job_id: string;
  hirer_id: string;
  helper_id: string;
  started_by: string;
  current_price: number;
  last_offer_by: string;
  offer_count: number;
  history: OfferEvent[];
  status: NegotiationStatus;
  expires_at: string;
  closed_at: string | null;
}

export type SosStatus = "open" | "acknowledged" | "resolved";

export interface SosEvent {
  id: string;
  created_at: string;
  job_id: string | null;
  raised_by: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  message: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: SosStatus;
  resolved_at: string | null;
}

export type NotificationKind = "offer_received" | "offer_sent" | "countered" | "accepted" | "declined" | "lapsed";

export interface Notification {
  id: string;
  profile_id: string;
  negotiation_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
