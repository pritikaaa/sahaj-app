import { Badge } from "@/components/ui/badge";
import type { JobStatus, NegotiationStatus } from "@/lib/types";

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
