import { notFound } from "next/navigation";
import { NegotiationRoom } from "@/components/negotiation-room";
import { getNegotiationViewAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function NegotiationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getNegotiationViewAction(id);
  if (!r.ok) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Agree a price</h1>
      {/* Keyed by person too: after "Switch person" the room must start fresh as the new person. */}
      <NegotiationRoom key={`${id}:${r.value.meId ?? "none"}`} initial={r.value} />
    </div>
  );
}
