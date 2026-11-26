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
      <h1 className="text-2xl font-semibold tracking-tight">Agree a price</h1>
      <NegotiationRoom key={id} initial={r.value} />
    </div>
  );
}
