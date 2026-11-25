"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitVerificationAction } from "@/app/actions";

export function VerificationForm({ isStudent }: { isStudent: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [num, setNum] = useState("");
  const [issuer, setIssuer] = useState("");
  const type = isStudent ? "student_id" : "government_id";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await submitVerificationAction({ verification_type: type, verification_number: num, verification_issuer: issuer });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Submitted — the Sahaj team will check your ID.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Verify your identity">
      <p className="text-sm">
        {isStudent
          ? "Enter the details on your student ID card. Bring the card when the team checks it."
          : "Enter your citizenship, driving licence or passport number. Bring the document when the team checks it."}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="v_num">{isStudent ? "Student ID number" : "Government ID number"}</Label>
          <Input id="v_num" required value={num} onChange={(e) => setNum(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v_issuer">{isStudent ? "College / school" : "Issuing office"}</Label>
          <Input id="v_issuer" required placeholder={isStudent ? "e.g. Prithvi Narayan Campus" : "e.g. DAO Kaski"} value={issuer} onChange={(e) => setIssuer(e.target.value)} />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">Only the Sahaj team sees this number. Other users only see your badge.</p>
      <Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit for verification"}</Button>
    </form>
  );
}
