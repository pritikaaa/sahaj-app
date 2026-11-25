import type { Profile } from "./types";

/** What other people may see about someone. ID numbers and trusted contacts stay private. */
export type PublicProfile = Omit<
  Profile,
  "verification_number" | "verification_issuer" | "trusted_contact_name" | "trusted_contact_phone"
>;

export function toPublic(p: Profile): PublicProfile {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { verification_number, verification_issuer, trusted_contact_name, trusted_contact_phone, ...rest } = p;
  return rest;
}
