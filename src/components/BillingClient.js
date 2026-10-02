"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BuyCreditsModal from "./BuyCreditsModal";
import { CREDIT_PACKS, MAX_CREDITS, MIN_CREDITS, NETWORKS, PRICE_PER_CREDIT, tsh } from "@/lib/credit-packs";

const STATUS_LABEL = {
  pending: "Waiting for approval",
  completed: "Paid",
  failed: "Not completed",
  voided: "Cancelled",
  expired: "Expired",
};

const REASON_LABEL = { scan: "Scan", purchase: "Credits bought", welcome: "Welcome bonus", "launch bonus": "Launch bonus", test: "Test credits" };

const when = (iso) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const networkName = (id) => NETWORKS.find((n) => n.id === id)?.label || id;

// Flat page: headings, text and spacing only. No cards, no boxes, no divider lines.
export default function BillingClient({ initialBalance, scanCost, email, purchases, ledger }) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [buyOpen, setBuyOpen] = useState(false);

  return (
    <div className="space-y-14">
      <section>
        <h2 className="font-serif text-3xl text-navy">Credits</h2>
        <p className="mt-6 text-sm font-medium text-navy">Credit remaining</p>
        <p className="mt-1 font-serif text-6xl leading-none text-navy sm:text-7xl">{balance}</p>
        <p className="mt-3 text-sm text-muted">
          {scanCost} {scanCost === 1 ? "credit" : "credits"} per scan &middot; {email}
        </p>
        {balance === 0 && <p className="mt-3 text-sm text-amber-800">You have no credits. Buy some to keep scanning.</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={() => setBuyOpen(true)}>
            Buy credits
          </button>
          <a href="#history" className="inline-flex min-h-[44px] items-center rounded-full bg-line px-5 font-semibold text-navy hover:brightness-95">
            View usage
          </a>
        </div>
      </section>

      <section>
        <h2 className="font-serif text-2xl text-navy">Pricing</h2>
        <p className="mt-2 text-sm text-muted">
          {tsh(PRICE_PER_CREDIT)} per credit. Credits never expire, and one is used only when a report is produced.
        </p>
        <dl className="mt-5 space-y-3">
          {CREDIT_PACKS.map((p) => (
            <div key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 sm:max-w-md">
              <dt className="text-navy">{p.credits} credits</dt>
              <dd className="text-navy">{tsh(p.amount)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-sm text-muted">
          Or choose your own amount, from {MIN_CREDITS} to {MAX_CREDITS} credits. Pay with {NETWORKS.map((n) => n.label).join(", ")}.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-2xl text-navy">Payments</h2>
        {purchases.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="mt-5 space-y-5">
            {purchases.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-sm sm:max-w-xl">
                <span>
                  <span className="text-navy">{p.credits} credits</span>
                  <span className="text-muted">
                    {" "}
                    &middot; {tsh(p.amount)} &middot; {networkName(p.provider)}
                  </span>
                  <span className="block text-xs text-muted">{when(p.created_at)}</span>
                </span>
                <span className={p.status === "completed" ? "font-medium text-emerald-700" : "text-muted"}>{STATUS_LABEL[p.status] || p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="history" className="scroll-mt-6">
        <h2 className="font-serif text-2xl text-navy">Usage</h2>
        {ledger.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="mt-5 space-y-5">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-6 text-sm sm:max-w-xl">
                <span>
                  <span className="text-navy">{REASON_LABEL[l.reason] || l.reason}</span>
                  <span className="block text-xs text-muted">{when(l.created_at)}</span>
                </span>
                <span className={l.delta > 0 ? "font-medium text-emerald-700" : "text-navy"}>
                  {l.delta > 0 ? "+" : ""}
                  {l.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {buyOpen && (
        <BuyCreditsModal
          onClose={() => {
            setBuyOpen(false);
            router.refresh(); // reload the payment and usage lists
          }}
          onCredits={setBalance}
        />
      )}
    </div>
  );
}
