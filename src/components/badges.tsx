import { BadgeCheck, Clock, GraduationCap, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { verificationLabel } from "@/lib/format";
import type { JobStatus, NegotiationStatus, Profile } from "@/lib/types";

export function VerificationBadge({ p }: { p: Pick<Profile, "verification_status" | "verification_type"> }) {
  const label = verificationLabel(p);
  if (p.verification_status === "verified") {
    return (
      <Badge variant="success">
        {p.verification_type === "student_id" ? <GraduationCap aria-hidden /> : <BadgeCheck aria-hidden />} {label}
      </Badge>
    );
  }
  if (p.verification_status === "pending") return <Badge variant="warning"><Clock aria-hidden /> {label}</Badge>;
  return <Badge variant="outline" className="text-muted-foreground"><ShieldAlert aria-hidden /> {label}</Badge>;
}

const JOB: Record<JobStatus, { label: string; variant: "default" | "secondary" | "success" | "outline" | "destructive" | "warning" }> = {
  open: { label: "Open", variant: "secondary" },
  booked: { label: "Booked", variant: "default" },
  in_progress: { label: "In progress", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "outline" },
};
export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={JOB[status].variant}>{JOB[status].label}</Badge>;
}

const NEG: Record<NegotiationStatus, { label: string; variant: "default" | "secondary" | "success" | "outline" | "destructive" }> = {
  active: { label: "Live", variant: "default" },
  accepted: { label: "Agreed", variant: "success" },
  declined: { label: "Declined", variant: "outline" },
  expired: { label: "Lapsed", variant: "outline" },
};
export function NegotiationBadge({ status }: { status: NegotiationStatus }) {
  return <Badge variant={NEG[status].variant}>{NEG[status].label}</Badge>;
}
