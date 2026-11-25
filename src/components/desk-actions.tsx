"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reviewVerificationAction, updateSosAction } from "@/app/actions";

export function ReviewButtons({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (d: "verified" | "rejected") =>
    start(async () => {
      const r = await reviewVerificationAction(profileId, d);
      if (!r.ok) return void toast.error(r.error);
      toast.success(d === "verified" ? "Verified" : "Rejected");
      router.refresh();
    });
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => go("verified")}>Approve</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => go("rejected")}>Reject</Button>
    </div>
  );
}

export function SosButtons({ id, status }: { id: string; status: "open" | "acknowledged" | "resolved" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (s: "acknowledged" | "resolved") =>
    start(async () => {
      const r = await updateSosAction(id, s);
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });
  if (status === "resolved") return null;
  return (
    <div className="flex gap-2">
      {status === "open" && <Button size="sm" variant="destructive" disabled={pending} onClick={() => go("acknowledged")}>Acknowledge</Button>}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => go("resolved")}>Resolve</Button>
    </div>
  );
}
