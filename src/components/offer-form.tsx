"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { makeOfferAction } from "@/app/actions";

export function OfferForm({ jobId, suggested }: { jobId: string; suggested: number | null }) {
  const router = useRouter();
  const [price, setPrice] = useState(suggested ? String(suggested) : "");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex w-full flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await makeOfferAction(jobId, price);
          if (!r.ok) return void toast.error(r.error);
          router.push(`/negotiations/${r.value.negotiationId}`);
        });
      }}
    >
      <label htmlFor={`price-${jobId}`} className="sr-only">Your price in NPR</label>
      <div className="relative w-36">
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">NPR</span>
        <Input id={`price-${jobId}`} inputMode="numeric" className="pl-12" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Starting…" : "Offer & start 1-min deal"}</Button>
    </form>
  );
}
