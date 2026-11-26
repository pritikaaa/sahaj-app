"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Phone, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { raiseSosAction } from "@/app/actions";
import { POLICE_NUMBER } from "@/lib/constants";
import type { SosEvent } from "@/lib/types";

function getPosition(): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 })
  );
}

/** M4: one tap → recorded event (time + location) → team desk alerted, phone dials the police. */
export function SosButton({ jobId = null }: { jobId?: string | null }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [sent, setSent] = useState<SosEvent | null>(null);
  const [pending, start] = useTransition();

  function fire() {
    start(async () => {
      const pos = await getPosition();
      const r = await raiseSosAction(jobId, {
        latitude: pos?.coords.latitude ?? null,
        longitude: pos?.coords.longitude ?? null,
        accuracy: pos?.coords.accuracy ?? null,
      });
      setArmed(false);
      if (!r.ok) return void toast.error(r.error);
      setSent(r.value);
      // Open the dialer with the police number as soon as the SOS is recorded (phones only).
      window.location.href = `tel:${POLICE_NUMBER}`;
      toast.error("SOS sent to the Sahaj team desk", { duration: 8000 });
      router.refresh();
    });
  }

  if (sent) {
    const where = sent.latitude != null ? `https://maps.google.com/?q=${sent.latitude},${sent.longitude}` : null;
    return (
      <div role="alert" className="border-destructive bg-destructive/10 space-y-3 rounded-lg border p-4">
        <p className="font-semibold">SOS sent. The Sahaj team desk has been alerted and your phone is dialling the police ({POLICE_NUMBER}).</p>
        <p className="text-sm">{where ? "Your location was shared." : "Location was not available — tell the team where you are."}</p>
        {/* Manual fallback in case the browser blocked the automatic dial. */}
        <Button asChild variant="destructive" size="lg" className="w-full">
          <a href={`tel:${POLICE_NUMBER}`}><Phone aria-hidden /> Call police ({POLICE_NUMBER})</a>
        </Button>
      </div>
    );
  }

  if (armed) {
    return (
      <div className="border-destructive space-y-3 rounded-lg border p-4">
        <p className="font-medium">Send SOS now? SOS alerts the Sahaj team desk and dials the police ({POLICE_NUMBER}). The desk sees your name, booking and location.</p>
        <div className="flex gap-2">
          <Button variant="destructive" size="lg" disabled={pending} onClick={fire} className="flex-1">
            <Siren aria-hidden /> {pending ? "Sending…" : "Yes, send SOS"}
          </Button>
          <Button variant="outline" size="lg" disabled={pending} onClick={() => setArmed(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <Button variant="destructive" size="lg" className="w-full" onClick={() => setArmed(true)}>
      <Siren aria-hidden /> SOS
    </Button>
  );
}
