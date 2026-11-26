"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Handshake, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NegotiationBadge, VerificationBadge } from "./badges";
import { getNegotiationViewAction, reopenNegotiationAction, respondAction, type NegotiationView } from "@/app/actions";
import { describeSchedule, formatNPR } from "@/lib/format";
import { MAX_OFFERS, NEGOTIATION_SECONDS, PRICE_FLOOR } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function NegotiationRoom({ initial }: { initial: NegotiationView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [deadline, setDeadline] = useState(() => Date.now() + initial.secondsLeft * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [counter, setCounter] = useState("");
  const [pending, start] = useTransition();
  const lastStatus = useRef(initial.negotiation.status);

  const n = view.negotiation;
  const me = view.meId;
  const role = me === n.hirer_id ? "hirer" : me === n.helper_id ? "helper" : null;
  const other = role === "hirer" ? view.helper : view.hirer;
  const nameOf = (id: string) => (id === me ? "You" : id === n.hirer_id ? view.hirer.full_name : view.helper.full_name);
  const left = n.status === "active" ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const live = n.status === "active" && left > 0;
  const myTurn = live && role !== null && n.last_offer_by !== me;

  const apply = useCallback((v: NegotiationView) => {
    setView(v);
    setDeadline(Date.now() + v.secondsLeft * 1000);
    if (lastStatus.current === "active" && v.negotiation.status !== "active") {
      if (v.negotiation.status === "accepted") toast.success(`Deal agreed at ${formatNPR(v.negotiation.current_price)}!`);
      else if (v.negotiation.status === "expired") toast.message("Time is up — the offer lapsed.");
      else toast.message("The negotiation was declined.");
    }
    lastStatus.current = v.negotiation.status;
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (n.status !== "active") return;
    const poll = setInterval(async () => {
      const r = await getNegotiationViewAction(n.id);
      if (r.ok) apply(r.value);
    }, 1500);
    return () => clearInterval(poll);
  }, [n.id, n.status, apply]);

  // When the local clock hits zero, ask the server (which closes the session).
  useEffect(() => {
    if (n.status === "active" && left === 0) {
      getNegotiationViewAction(n.id).then((r) => r.ok && apply(r.value));
    }
  }, [left, n.status, n.id, apply]);

  function act(r: Parameters<typeof respondAction>[1]) {
    start(async () => {
      const res = await respondAction(n.id, r);
      if (!res.ok) {
        toast.error(res.error);
        const fresh = await getNegotiationViewAction(n.id);
        if (fresh.ok) apply(fresh.value);
        return;
      }
      setCounter("");
      apply(res.value);
      router.refresh();
    });
  }

  function retry() {
    start(async () => {
      const res = await reopenNegotiationAction(n.id, n.current_price);
      if (!res.ok) return void toast.error(res.error);
      router.push(`/negotiations/${res.value.negotiationId}`);
    });
  }

  const pct = (left / NEGOTIATION_SECONDS) * 100;

  return (
    <div className="space-y-4">
      <Card className={cn(live && "border-primary")}>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Handshake className="text-primary size-5" aria-hidden /> {view.job.title} <NegotiationBadge status={n.status} />
          </CardTitle>
          <CardDescription>
            {describeSchedule(view.job)} · {view.job.area} · {view.job.chores.join(", ")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs uppercase">Current offer · per visit</p>
              <p className="text-3xl font-semibold tabular-nums" data-testid="current-price">{formatNPR(n.current_price)}</p>
              <p className="text-muted-foreground text-sm">by {nameOf(n.last_offer_by)}</p>
            </div>
            <div className="text-right" aria-live="polite">
              <p className="text-muted-foreground text-xs uppercase">Time left</p>
              <p className={cn("font-mono text-3xl font-semibold tabular-nums", left <= 10 && live && "text-destructive")} data-testid="seconds-left">
                {left}s
              </p>
            </div>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
            <div className={cn("bg-primary h-full transition-[width] duration-300", left <= 10 && "bg-destructive")} style={{ width: `${pct}%` }} />
          </div>

          {role && other && (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              With <strong>{other.full_name}</strong> <VerificationBadge p={other} />
            </p>
          )}

          {myTurn && (
            <div className="space-y-3">
              <Button size="lg" className="w-full" disabled={pending} onClick={() => act({ type: "accept" })}>
                <Check aria-hidden /> Accept {formatNPR(n.current_price)}
              </Button>
              {n.offer_count < MAX_OFFERS ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const price = Number(counter.replace(/[,\s]/g, ""));
                    act({ type: "counter", price });
                  }}
                >
                  <label htmlFor="counter" className="sr-only">Counter-offer in NPR</label>
                  <Input id="counter" inputMode="numeric" placeholder={`Counter (min ${PRICE_FLOOR})`} value={counter} onChange={(e) => setCounter(e.target.value)} />
                  <Button type="submit" variant="secondary" disabled={pending || !counter}>Counter</Button>
                </form>
              ) : (
                <p className="text-muted-foreground text-sm">No counters left — accept or decline.</p>
              )}
              <Button variant="ghost" className="w-full" disabled={pending} onClick={() => act({ type: "decline" })}>
                <X aria-hidden /> Decline
              </Button>
            </div>
          )}

          {live && role && !myTurn && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-sm">Waiting for {other?.full_name.split(" ")[0]} to accept or counter…</p>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => act({ type: "decline" })}>Withdraw</Button>
            </div>
          )}

          {n.status === "accepted" && (
            <div className="bg-success/10 space-y-2 rounded-lg p-4">
              <p className="font-medium">Booked at {formatNPR(n.current_price)} per visit.</p>
              <Button asChild><Link href={`/jobs/${view.job.id}`}>Open booking</Link></Button>
            </div>
          )}

          {(n.status === "expired" || n.status === "declined") && role && (
            <div className="space-y-2">
              <p className="text-sm">{n.status === "expired" ? "The minute ran out before you agreed." : "This negotiation was declined."}</p>
              {view.job.status === "open" && (
                <Button variant="outline" disabled={pending} onClick={retry}>
                  <RotateCcw aria-hidden /> Try again at {formatNPR(n.current_price)}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Offers ({n.offer_count}/{MAX_OFFERS})</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-1.5 text-sm">
            {n.history.map((h, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{nameOf(h.by)} {h.action === "offer" ? "offered" : h.action === "counter" ? "countered" : h.action === "accept" ? "accepted" : "declined"}</span>
                <span className="tabular-nums">{formatNPR(h.price)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
