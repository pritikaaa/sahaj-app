// "Acting as" — which person this browser is using. This is NOT auth
// (MVP rule: no login/signup). It lets one demo device switch between
// people, and lets the same person both hire and work.
import "server-only";
import { cookies } from "next/headers";
import { getProfile } from "./data";
import type { Profile } from "./types";

export const PROFILE_COOKIE = "sahaj_profile";

export async function currentProfileId(): Promise<string | null> {
  return (await cookies()).get(PROFILE_COOKIE)?.value ?? null;
}

export async function currentProfile(): Promise<Profile | null> {
  const id = await currentProfileId();
  if (!id) return null;
  try {
    return await getProfile(id);
  } catch {
    return null;
  }
}

export async function setCurrentProfile(id: string | null): Promise<void> {
  const jar = await cookies();
  if (id) jar.set(PROFILE_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  else jar.delete(PROFILE_COOKIE);
}
