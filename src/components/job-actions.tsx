"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setJobStatusAction } from "@/app/actions";
import type { JobStatus } from "@/lib/types";

export function JobActions({ jobId, status, isPoster, isHelper }: { jobId: string; status: JobStatus; isPoster: boolean; isHelper: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (s: "in_progress" | "completed" | "cancelled", msg: string) =>
    start(async () => {
      const r = await setJobStatusAction(jobId, s);
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      {status === "booked" && isHelper && <Button disabled={pending} onClick={() => go("in_progress", "Job started")}>Start job</Button>}
      {(status === "booked" || status === "in_progress") && (isPoster || isHelper) && (
        <Button variant="secondary" disabled={pending} onClick={() => go("completed", "Marked as completed")}>Mark completed</Button>
      )}
      {(status === "booked" || (status === "open" && isPoster)) && (
        <Button variant="ghost" disabled={pending} onClick={() => go("cancelled", "Cancelled")}>Cancel</Button>
      )}
    </div>
  );
}
