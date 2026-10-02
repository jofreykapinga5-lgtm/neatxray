"use client";

import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import {
  CREDIT_PACKS,
  CUSTOM_PACK_ID,
  MAX_CREDITS,
  MIN_CREDITS,
  NETWORKS,
  PRICE_PER_CREDIT,
  resolvePurchase,
  tsh,
} from "@/lib/credit-packs";

const POLL_MS = 3000;
const MAX_POLLS = 80; // 80 checks, 3 seconds apart: about 4 minutes. The provider expires an unapproved payment much later.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A short note under each pack, in the spirit of "Starting out / Recommended".
const TILE_NOTE = { p5: "Starting out", p20: "Recommended", p50: "High volume" };

export default function BuyCreditsModal({ onClose, onCredits, initialPackId, balance = null }) {
  const dialogRef = useRef(null);
  const stoppedRef = useRef(false);
  const amountRef = useRef(null);
  const startPack = CREDIT_PACKS.find((p) => p.id === initialPackId);

  const [phase, setPhase] = useState("form"); // form | waiting | done | failed
  const [tile, setTile] = useState(initialPackId ? (startPack ? startPack.id : CUSTOM_PACK_ID) : CREDIT_PACKS[1]?.id || CREDIT_PACKS[0].id);
  const [amount, setAmount] = useState(startPack ? String(startPack.credits) : initialPackId ? "" : String(CREDIT_PACKS[1]?.credits || CREDIT_PACKS[0].credits));
  const [provider, setProvider] = useState(NETWORKS[0].id);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [bought, setBought] = useState(null);

  // A typed number that equals a pack counts as that pack; anything else is a custom amount.
  const matched = CREDIT_PACKS.find((p) => String(p.credits) === amount.trim());
  const packId = matched ? matched.id : CUSTOM_PACK_ID;
  const pack = resolvePurchase(packId, amount); // null while the number is missing or out of range

  useDialogFocus(dialogRef, () => {
    if (phase !== "waiting") onClose();
  });

  // Opened from "Custom": put the cursor in the amount box once the window has settled.
  useEffect(() => {
    if (initialPackId !== CUSTOM_PACK_ID) return;
    const t = setTimeout(() => amountRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [initialPackId]);

  useEffect(() => {
    stoppedRef.current = false;
    return () => {
      stoppedRef.current = true;
    };
  }, []);

  function pickPack(p) {
    setTile(p.id);
    setAmount(String(p.credits));
  }

  function pickOther() {
    setTile(CUSTOM_PACK_ID);
    setAmount("");
    amountRef.current?.focus();
  }

  function onAmount(value) {
    const clean = value.replace(/[^\d]/g, "").slice(0, 4);
    setAmount(clean);
    const hit = CREDIT_PACKS.find((p) => String(p.credits) === clean);
    setTile(hit ? hit.id : CUSTOM_PACK_ID);
  }

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
        body: JSON.stringify({ packId, credits: amount, provider, phone }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "The payment could not be started.");

      for (let attempt = 0; attempt < MAX_POLLS && !stoppedRef.current; attempt++) {
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

  const tileClass = (active) =>
    `cursor-pointer rounded-xl border p-3 text-left transition-colors ${active ? "border-accent bg-accent/10" : "border-line bg-white hover:border-accent/50"}`;

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
        className="motion-sheet flex w-full max-w-[34rem] flex-col overflow-hidden bg-white outline-none sm:max-h-[94vh] sm:rounded-2xl sm:shadow-[0_30px_80px_rgba(31,53,86,0.35)]"
      >
        <div className="px-5 pb-1 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id="buy-title" className="text-2xl font-bold tracking-tight text-navy">
              Add credits
            </h2>
            {phase !== "waiting" && (
              <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 grid h-10 w-10 place-items-center rounded-full text-muted hover:text-navy">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
          {balance !== null && (
            <p className="text-sm text-muted">
              Current balance: {balance} {balance === 1 ? "credit" : "credits"}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4 sm:px-6">
          {phase === "form" || phase === "failed" ? (
            <form onSubmit={pay} className="space-y-5">
              {phase === "failed" && (
                <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                  {error}
                </p>
              )}

              <fieldset>
                <legend className="sr-only">Choose how many credits</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CREDIT_PACKS.map((p) => (
                    <label key={p.id} className={tileClass(tile === p.id)}>
                      <input type="radio" name="pack" value={p.id} checked={tile === p.id} onChange={() => pickPack(p)} className="sr-only" />
                      <span className="block text-sm font-semibold text-navy">{p.credits} credits</span>
                      <span className="mt-1.5 inline-block rounded-md bg-line px-1.5 py-0.5 text-[11px] text-muted">{TILE_NOTE[p.id] || tsh(p.amount)}</span>
                    </label>
                  ))}
                  <label className={tileClass(tile === CUSTOM_PACK_ID)}>
                    <input type="radio" name="pack" value={CUSTOM_PACK_ID} checked={tile === CUSTOM_PACK_ID} onChange={pickOther} className="sr-only" />
                    <span className="block text-sm font-semibold text-navy">Other</span>
                    <span className="mt-1.5 inline-block rounded-md bg-line px-1.5 py-0.5 text-[11px] text-muted">Your amount</span>
                  </label>
                </div>
              </fieldset>

              <div>
                <label htmlFor="credit-amount" className="text-sm font-semibold text-navy">
                  Enter amount{" "}
                  <span className="font-normal text-muted">
                    {MIN_CREDITS} credits minimum, {MAX_CREDITS} maximum
                  </span>
                </label>
                <div className="relative mt-2">
                  <input
                    id="credit-amount"
                    ref={amountRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={amount}
                    onChange={(e) => onAmount(e.target.value)}
                    onFocus={() => !matched && setTile(CUSTOM_PACK_ID)}
                    className="field w-full pr-20 text-base"
                    placeholder={String(MIN_CREDITS)}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">credits</span>
                </div>
              </div>

              <div className="space-y-2.5 rounded-xl border border-line bg-bg p-4 text-sm">
                <div className="flex justify-between text-muted">
                  <span>Credits</span>
                  <span>{pack ? pack.credits : "--"}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Price per credit</span>
                  <span>{tsh(PRICE_PER_CREDIT)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <span className="text-navy">Total due</span>
                  <span className="text-xl font-bold text-navy">{pack ? tsh(pack.amount) : "TSh --"}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="pay-network" className="text-sm font-semibold text-navy">
                    Pay with
                  </label>
                  <select id="pay-network" value={provider} onChange={(e) => setProvider(e.target.value)} className="field mt-2 w-full text-base">
                    {NETWORKS.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="pay-phone" className="text-sm font-semibold text-navy">
                    Phone number
                  </label>
                  <input
                    id="pay-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712 345 678"
                    className="field mt-2 w-full text-base"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!pack}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-navy px-5 font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pack ? `Buy ${pack.credits} credits` : "Buy 0 credits"}
              </button>

              <p className="text-xs leading-relaxed text-muted">
                Credits never expire, and one is used only when a report is produced. You will get a prompt on your phone to approve the payment.
              </p>
            </form>
          ) : null}

          {phase === "waiting" && (
            <div className="space-y-3 py-10 text-center" aria-live="polite">
              <p className="text-xl font-bold text-navy">Check your phone</p>
              <p className="text-sm text-muted">
                Approve the {pack ? tsh(pack.amount) : ""} payment on your phone. This window updates by itself. Please do not close it.
              </p>
            </div>
          )}

          {phase === "done" && (
            <div className="space-y-3 py-10 text-center" aria-live="polite">
              <p className="text-xl font-bold text-navy">Payment received</p>
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
