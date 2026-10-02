"use client";

import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { CREDIT_PACKS, CUSTOM_PACK_ID, MAX_CREDITS, MIN_CREDITS, NETWORKS, resolvePurchase, tsh } from "@/lib/credit-packs";

const POLL_MS = 3000;
const GIVE_UP_MS = 4 * 60 * 1000; // the provider expires an unapproved payment after a few hours; we stop waiting sooner
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function BuyCreditsModal({ onClose, onCredits }) {
  const dialogRef = useRef(null);
  const stoppedRef = useRef(false);
  const [phase, setPhase] = useState("form"); // form | waiting | done | failed
  const [packId, setPackId] = useState(CREDIT_PACKS[0].id);
  const [custom, setCustom] = useState("");
  const [provider, setProvider] = useState(NETWORKS[0].id);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [bought, setBought] = useState(null);

  const pack = resolvePurchase(packId, custom); // null while a custom number is missing or out of range

  useDialogFocus(dialogRef, () => {
    if (phase !== "waiting") onClose();
  });

  useEffect(() => {
    stoppedRef.current = false;
    return () => {
      stoppedRef.current = true;
    };
  }, []);

  async function pay(e) {
    e.preventDefault();
    setError("");
    if (!pack) {
      setPhase("failed");
      setError(`Enter between ${MIN_CREDITS} and ${MAX_CREDITS} credits.`);
      return;
    }
    setPhase("waiting");
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, credits: custom, provider, phone }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "The payment could not be started.");

      const started = Date.now();
      while (!stoppedRef.current && Date.now() - started < GIVE_UP_MS) {
        await sleep(POLL_MS);
        const r = await fetch(`/api/payments/status?id=${body.purchaseId}`);
        const s = await r.json().catch(() => ({}));
        if (s.status === "completed") {
          if (typeof s.balance === "number") onCredits?.(s.balance);
          setBought(pack?.credits);
          setPhase("done");
          return;
        }
        if (["failed", "voided", "expired"].includes(s.status)) {
          throw new Error("The payment was not completed. You have not been charged.");
        }
      }
      if (!stoppedRef.current) {
        throw new Error("We did not see the payment yet. If money left your account, your credits will appear shortly. Check the credit count in the top bar.");
      }
    } catch (err) {
      if (stoppedRef.current) return;
      setError(err.message || "Something went wrong.");
      setPhase("failed");
    }
  }

  return (
    <div
      className="motion-fade fixed inset-0 z-50 flex items-stretch justify-center bg-navy/60 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== "waiting") onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-title"
        className="motion-sheet flex w-full max-w-lg flex-col overflow-hidden bg-surface outline-none sm:max-h-[92vh] sm:rounded-3xl sm:shadow-[0_30px_80px_rgba(31,53,86,0.35)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id="buy-title" className="font-serif text-2xl text-navy">
            Buy credits
          </h2>
          {phase !== "waiting" && (
            <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost !px-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {phase === "form" || phase === "failed" ? (
            <form onSubmit={pay} className="space-y-5">
              <p className="text-sm text-muted">1 credit = 1 scan. Pay with mobile money; credits are added as soon as you approve on your phone.</p>

              {phase === "failed" && (
                <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                  {error}
                </p>
              )}

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-navy">Choose a pack</legend>
                <div className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
                  {CREDIT_PACKS.map((p) => (
                    <label
                      key={p.id}
                      className={`cursor-pointer rounded-2xl border p-3 text-center transition-colors ${packId === p.id ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}
                    >
                      <input type="radio" name="pack" value={p.id} checked={packId === p.id} onChange={() => setPackId(p.id)} className="sr-only" />
                      <span className="block font-serif text-2xl text-navy">{p.credits}</span>
                      <span className="block text-xs text-muted">credits</span>
                      <span className="mt-1 block text-sm font-medium text-navy">{tsh(p.amount)}</span>
                    </label>
                  ))}
                </div>
                <label
                  className={`block cursor-pointer rounded-2xl border p-3 transition-colors ${packId === CUSTOM_PACK_ID ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}
                >
                  <input type="radio" name="pack" value={CUSTOM_PACK_ID} checked={packId === CUSTOM_PACK_ID} onChange={() => setPackId(CUSTOM_PACK_ID)} className="sr-only" />
                  <span className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-navy">Choose your own amount</span>
                    <span className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={MIN_CREDITS}
                        max={MAX_CREDITS}
                        step="1"
                        value={custom}
                        onFocus={() => setPackId(CUSTOM_PACK_ID)}
                        onChange={(e) => {
                          setPackId(CUSTOM_PACK_ID);
                          setCustom(e.target.value);
                        }}
                        placeholder={`${MIN_CREDITS}–${MAX_CREDITS}`}
                        aria-label="Number of credits"
                        className="w-28 rounded-xl border border-line bg-bg px-3 py-2 text-base outline-none focus:border-accent"
                      />
                      <span className="text-sm text-muted">credits</span>
                    </span>
                  </span>
                  {packId === CUSTOM_PACK_ID && (
                    <span className="mt-2 block text-xs text-muted">
                      {pack ? `${tsh(pack.amount)} for ${pack.credits} credits` : `Enter a whole number from ${MIN_CREDITS} to ${MAX_CREDITS}.`}
                    </span>
                  )}
                </label>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-navy">Mobile money network</legend>
                <div className="flex flex-wrap gap-2">
                  {NETWORKS.map((n) => (
                    <label
                      key={n.id}
                      className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors ${provider === n.id ? "border-accent bg-accent/10 text-navy" : "border-line text-muted hover:border-accent/50"}`}
                    >
                      <input type="radio" name="network" value={n.id} checked={provider === n.id} onChange={() => setProvider(n.id)} className="sr-only" />
                      {n.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-navy">Phone number to pay from</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712 345 678"
                  className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-base outline-none focus:border-accent"
                />
              </label>

              <button type="submit" disabled={!pack} className="btn-primary w-full justify-center disabled:opacity-50">
                {pack ? `Pay ${tsh(pack.amount)}` : "Choose how many credits"}
              </button>
            </form>
          ) : null}

          {phase === "waiting" && (
            <div className="space-y-4 py-8 text-center" aria-live="polite">
              <p className="font-serif text-2xl text-navy">Check your phone</p>
              <p className="text-sm text-muted">
                Approve the {pack ? tsh(pack.amount) : ""} payment on your phone. This window updates by itself. Please do not close it.
              </p>
            </div>
          )}

          {phase === "done" && (
            <div className="space-y-4 py-8 text-center" aria-live="polite">
              <p className="font-serif text-2xl text-navy">Payment received</p>
              <p className="text-sm text-muted">{bought} credits were added to your account.</p>
              <button type="button" onClick={onClose} className="btn-primary">
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
