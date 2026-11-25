"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { ChorePicker } from "./chore-picker";
import { AREAS, PRICE_FLOOR } from "@/lib/constants";
import { createProfileAction, saveProfileAction } from "@/app/actions";
import type { Profile } from "@/lib/types";

export function ProfileForm({ initial, mode }: { initial?: Profile | null; mode: "create" | "edit" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    full_name: initial?.full_name ?? "",
    phone: initial?.phone ?? "",
    area: initial?.area ?? "",
    bio: initial?.bio ?? "",
    offers_help: initial?.offers_help ?? false,
    chores: initial?.chores ?? [],
    min_price: initial?.min_price ? String(initial.min_price) : "",
    is_student: initial?.is_student ?? false,
    trusted_contact_name: initial?.trusted_contact_name ?? "",
    trusted_contact_phone: initial?.trusted_contact_phone ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = mode === "create" ? await createProfileAction(f) : await saveProfileAction(f);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(mode === "create" ? `Welcome to Sahaj, ${f.full_name.split(" ")[0]}!` : "Profile saved");
      if (mode === "create") router.push(f.offers_help ? "/profile" : "/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-label={mode === "create" ? "Create your profile" : "Edit profile"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" required value={f.full_name} onChange={(e) => set("full_name", e.target.value)} autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Mobile number</Label>
          <Input id="phone" inputMode="tel" placeholder="98XXXXXXXX" value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="area">Area in Pokhara</Label>
          <NativeSelect id="area" value={f.area} onChange={(e) => set("area", e.target.value)}>
            <option value="">Choose area…</option>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </NativeSelect>
        </div>
      </div>

      <fieldset className="bg-muted/50 space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Trusted contact for SOS</legend>
        <p className="text-muted-foreground text-xs">If you press SOS during a booking, the Sahaj team desk sees this number and calls them.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tc_name">Name</Label>
            <Input id="tc_name" value={f.trusted_contact_name} onChange={(e) => set("trusted_contact_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tc_phone">Mobile number</Label>
            <Input id="tc_phone" inputMode="tel" placeholder="98XXXXXXXX" value={f.trusted_contact_phone} onChange={(e) => set("trusted_contact_phone", e.target.value)} />
          </div>
        </div>
      </fieldset>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <Switch id="offers_help" checked={f.offers_help} onCheckedChange={(v) => set("offers_help", v)} />
          <div>
            <Label htmlFor="offers_help">I also offer help (take paid gigs)</Label>
            <p className="text-muted-foreground mt-1 text-xs">You can still post jobs and hire. One profile does both.</p>
          </div>
        </div>
        {f.offers_help && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Switch id="is_student" checked={f.is_student} onCheckedChange={(v) => set("is_student", v)} />
              <div>
                <Label htmlFor="is_student">I am a student</Label>
                <p className="text-muted-foreground mt-1 text-xs">Students verify with a student ID; adults with a government ID.</p>
              </div>
            </div>
            <ChorePicker legend="Chores I can do" value={f.chores} onChange={(v) => set("chores", v)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="min_price">My usual minimum (NPR per visit)</Label>
                <Input id="min_price" inputMode="numeric" placeholder={`${PRICE_FLOOR} or more`} value={f.min_price} onChange={(e) => set("min_price", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">About me</Label>
              <Textarea id="bio" maxLength={400} placeholder="Experience, languages, free hours…" value={f.bio} onChange={(e) => set("bio", e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving…" : mode === "create" ? "Create profile" : "Save profile"}
      </Button>
    </form>
  );
}
