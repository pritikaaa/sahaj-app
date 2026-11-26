"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Handshake, MessageSquareReply, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NegotiationBadge } from "./badges";
import { getNegotiationViewAction, reopenNegotiationAction, respondAction, type NegotiationView } from "@/app/actions";
import { describeSchedule, formatNPR } from "@/lib/format";
import { MAX_OFFERS, NEGOTIATION_SECONDS, PRICE_CEILING, PRICE_FLOOR } from "@/lib/constants";
import { cn } from "@/lib/utils";

const POLL_MS = 1000;
const ADJUST = [-100, -50, 50, 100];

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export function NegotiationRoom({ initial }: { initial: NegotiationView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [deadline, setDeadline] = useState(() => Date.now() + initial.secondsLeft * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [counter, setCounter] = useState("");
  const [counterOpen, setCounterOpen] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const lastStatus = useRef(initial.negotiation.status);
  const lastCount = useRef(initial.negotiation.offer_count);
  const lastMe = useRef(initial.meId);
  const thread = useRef<HTMLOListElement>(null);

  const n = view.negotiation;
  const me = view.meId;
  const role = me === n.hirer_id ? "hirer" : me === n.helper_id ? "helper" : null;
  const other = role === "hirer" ? view.helper : view.hirer;
  const otherFirst = other.full_name.split(" ")[0];
  const roleOf = (id: string) => (id === n.hirer_id ? "Hirer" : "Helper");
  const fullNameOf = (id: string) => (id === n.hirer_id ? view.hirer.full_name : view.helper.full_name);
  const left = n.status === "active" ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const live = n.status === "active" && left > 0;
  const mineOnTable = n.last_offer_by === me;
  const theirsOnTable = live && role !== null && !mineOnTable;
  const countersLeft = n.offer_count < MAX_OFFERS;

  const apply = useCallback((v: NegotiationView) => {
    // The "acting as" cookie is per browser: switching person in another tab switches this one too.
    if (v.meId !== lastMe.current) {
      const who = v.meId === v.negotiation.hirer_id ? v.hirer.full_name : v.meId === v.negotiation.helper_id ? v.helper.full_name : "someone else";
      toast.warning(`You're now acting as ${who}`, {
        description: "Switching person changes every tab in this browser. Use a private window for a second person.",
        duration: 8000,
      });
      lastMe.current = v.meId;
      lastCount.current = v.negotiation.offer_count;
    }
    setView(v);
    setDeadline(Date.now() + v.secondsLeft * 1000);
    const vn = v.negotiation;
    // A new offer from the other person: flash its bubble and say so.
    if (vn.offer_count > lastCount.current && vn.last_offer_by !== v.meId && v.meId) {
      const who = vn.last_offer_by === vn.hirer_id ? v.hirer.full_name : v.helper.full_name;
      toast(`${who.split(" ")[0]} countered ${formatNPR(vn.current_price)}`);
      const idx = vn.history.length - 1;
      setHighlight(idx);
      setTimeout(() => setHighlight((h) => (h === idx ? null : h)), 2500);
    }
    lastCount.current = vn.offer_count;
    if (lastStatus.current === "active" && vn.status !== "active") {
      if (vn.status === "accepted") toast.success(`Deal agreed at ${formatNPR(vn.current_price)}!`);
      else if (vn.status === "expired") toast.message("Time is up — the offer lapsed.");
      else toast.message("The negotiation was declined.");
    }
    lastStatus.current = vn.status;
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (n.status !== "active") return;
    const load = async () => {
      const r = await getNegotiationViewAction(n.id);
      if (r.ok) apply(r.value);
    };
    // Check at once (the person may have switched since this page was rendered),
    // then every second, and again whenever the tab comes back into view.
    load();
    const poll = setInterval(load, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [n.id, n.status, apply]);

  // When the local clock hits zero, ask the server (which closes the session).
  useEffect(() => {
    if (n.status === "active" && left === 0) {
      getNegotiationViewAction(n.id).then((r) => r.ok && apply(r.value));
    }
  }, [left, n.status, n.id, apply]);

  // Keep the newest offer in view (scrolls the thread only, not the page).
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [n.history.length]);

  // Nothing left to counter with: fold the panel away.
  useEffect(() => {
    if (!live || !countersLeft) setCounterOpen(false);
  }, [live, countersLeft]);

  function act(r: Parameters<typeof respondAction>[1]) {
    start(async () => {
      const res = await respondAction(n.id, r, me);
      if (!res.ok) {
        toast.error(res.error);
        // Refresh the view; a typed counter stays in the input.
        const fresh = await getNegotiationViewAction(n.id);
        if (fresh.ok) apply(fresh.value);
        return;
      }
      lastCount.current = res.value.negotiation.offer_count; // my own offer: no "countered" toast
      setCounter("");
      setCounterOpen(false);
      apply(res.value);
      router.refresh();
    });
  }

  const sendCounter = () => {
    const price = Number(counter.replace(/[,\s]/g, ""));
    act({ type: "counter", price, expectedOfferCount: n.offer_count });
  };

  function retry() {
    start(async () => {
      const res = await reopenNegotiationAction(n.id, n.current_price);
      if (!res.ok) return void toast.error(res.error);
      router.push(`/negotiations/${res.value.negotiationId}`);
    });
  }

  const pct = (left / NEGOTIATION_SECONDS) * 100;
  const tall = "min-h-11";

  const counterPanel = (
    <form
      className="bg-muted/60 space-y-3 rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        sendCounter();
      }}
    >
      <label htmlFor="counter" className="text-sm font-medium">
        {mineOnTable ? "Your new price (NPR per visit)" : `Your counter to ${otherFirst} (NPR per visit)`}
      </label>
      <Input
        id="counter"
        autoFocus
        inputMode="numeric"
        placeholder={`${PRICE_FLOOR}–${PRICE_CEILING.toLocaleString("en-US")}`}
        value={counter}
        onChange={(e) => setCounter(e.target.value)}
        className={cn(tall, "text-lg tabular-nums")}
      />
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Quick adjust from the current offer">
        {ADJUST.map((d) => (
          <Button
            key={d}
            type="button"
            variant="outline"
            className={cn(tall, "tabular-nums")}
            onClick={() => setCounter(String(Math.min(PRICE_CEILING, Math.max(PRICE_FLOOR, n.current_price + d))))}
          >
            {d > 0 ? `+${d}` : d}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" className={cn(tall, "flex-1")} disabled={pending || !counter.trim()}>
          Send counter
        </Button>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground rounded-sm px-2 text-sm underline-offset-4 hover:underline focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
          onClick={() => setCounterOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      <Card className={cn(live && "border-primary")}>
        <CardHeader className="space-y-2">
          {role && (
            <p className="bg-secondary text-secondary-foreground w-fit rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              You are the {role}
            </p>
          )}
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Handshake className="text-primary size-5" aria-hidden />
            {role === "hirer" ? `Hiring ${other.full_name}` : role === "helper" ? `Work for ${other.full_name}` : view.job.title}
            <NegotiationBadge status={n.status} />
          </CardTitle>
          <CardDescription>
            {view.job.title} · {describeSchedule(view.job)} · {view.job.area} · {view.job.chores.join(", ")}
          </CardDescription>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {role ? (
              <>
                <span><strong>You</strong> ({role === "hirer" ? "Hirer" : "Helper"})</span>
                <span className="text-muted-foreground" aria-hidden>↔</span>
                <span><strong>{other.full_name}</strong> ({role === "hirer" ? "Helper" : "Hirer"})</span>
              </>
            ) : (
              <>
                <span><strong>{view.hirer.full_name}</strong> (Hirer)</span>
                <span className="text-muted-foreground" aria-hidden>↔</span>
                <span><strong>{view.helper.full_name}</strong> (Helper)</span>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div
            className={cn(
              "flex items-end justify-between gap-4 rounded-xl border p-4",
              mineOnTable ? "border-primary/40 bg-primary/5" : "bg-muted/50"
            )}
          >
            <div>
              <p className={cn("text-xs font-semibold uppercase", mineOnTable ? "text-primary" : "text-muted-foreground")}>
                {role === null
                  ? `${fullNameOf(n.last_offer_by)}'s offer (${roleOf(n.last_offer_by)})`
                  : mineOnTable
                    ? "Your offer"
                    : `${otherFirst}'s offer to you`}{" "}
                · per visit
              </p>
              <p className="text-3xl font-semibold tabular-nums sm:text-4xl" data-testid="current-price">{formatNPR(n.current_price)}</p>
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

          {/* Their offer is on the table: exactly two choices. */}
          {theirsOnTable && (
            <div className="space-y-3">
              <div className={cn("grid gap-2", countersLeft ? "grid-cols-2" : "grid-cols-1")}>
                <Button
                  size="lg"
                  className={cn(tall, "w-full")}
                  disabled={pending}
                  onClick={() => act({ type: "accept", expectedOfferCount: n.offer_count })}
                >
                  <Check aria-hidden /> Accept {formatNPR(n.current_price)}
                </Button>
                {countersLeft && (
                  <Button
                    size="lg"
                    variant={counterOpen ? "secondary" : "default"}
                    className={cn(tall, "w-full")}
                    disabled={pending}
                    aria-expanded={counterOpen}
                    aria-controls="counter"
                    onClick={() => setCounterOpen((o) => !o)}
                  >
                    <MessageSquareReply aria-hidden /> Counter
                  </Button>
                )}
              </div>
              {!countersLeft && <p className="text-muted-foreground text-sm">No counters left, accept or decline.</p>}
              {counterOpen && countersLeft && counterPanel}
              <div className="text-center">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act({ type: "decline" })}
                  className="text-muted-foreground hover:text-destructive min-h-11 rounded-sm px-3 text-sm underline-offset-4 hover:underline focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* My offer is on the table: wait, withdraw, or change it. */}
          {live && role && mineOnTable && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex-1 text-sm">Waiting for {otherFirst}…</p>
                <Button variant="outline" size="sm" className={tall} disabled={pending} onClick={() => act({ type: "decline" })}>
                  Withdraw
                </Button>
              </div>
              {countersLeft && !counterOpen && (
                <button
                  type="button"
                  className="text-primary min-h-11 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
                  onClick={() => setCounterOpen(true)}
                >
                  Change my offer
                </button>
              )}
              {!countersLeft && <p className="text-muted-foreground text-sm">No counters left, accept or decline.</p>}
              {counterOpen && countersLeft && counterPanel}
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
          <ol ref={thread} aria-live="polite" aria-label="Offer history" className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {n.history.map((h, i) => {
              const mine = h.by === me;
              const time = (
                <time dateTime={h.at} suppressHydrationWarning className="text-xs opacity-75">
                  {clock(h.at)}
                </time>
              );
              if (h.action === "accept" || h.action === "decline") {
                return (
                  <li key={i} className="text-muted-foreground py-1 text-center text-sm">
                    {mine ? "You" : `${fullNameOf(h.by)} (${roleOf(h.by)})`} {h.action === "accept" ? "accepted" : "declined"}{" "}
                    {h.action === "accept" && formatNPR(h.price)} · {time}
                  </li>
                );
              }
              return (
                <li key={i} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2 transition-shadow duration-500",
                      mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm",
                      highlight === i && "ring-primary ring-4 ring-offset-2"
                    )}
                  >
                    <p className="text-xs font-medium opacity-80">
                      {mine ? "You" : `${fullNameOf(h.by)} (${roleOf(h.by)})`} · {h.action === "offer" ? "offered" : "countered"}
                    </p>
                    <p className="text-lg font-semibold tabular-nums">{formatNPR(h.price)}</p>
                    {time}
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
