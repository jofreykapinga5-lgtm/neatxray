"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BuyCreditsModal from "./BuyCreditsModal";
import { CREDIT_PACKS, NETWORKS, tsh } from "@/lib/credit-packs";

const STATUS_LABEL = {
  pending: "Waiting for approval",
  completed: "Paid",
  failed: "Not completed",
  voided: "Cancelled",
  expired: "Expired",
};

const REASON_LABEL = { scan: "Scan", purchase: "Credits bought", "launch bonus": "Launch bonus", test: "Test credits" };

const when = (iso) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const networkName = (id) => NETWORKS.find((n) => n.id === id)?.label || id;

export default function BillingClient({ initialBalance, scanCost, email, purchases, ledger }) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [buyOpen, setBuyOpen] = useState(false);

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6">
        <p className="text-sm text-muted">{email}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-serif text-6xl leading-none text-navy">{balance}</p>
            <p className="mt-2 text-sm text-muted">
              {balance === 1 ? "credit" : "credits"} left &middot; {scanCost} {scanCost === 1 ? "credit" : "credits"} per scan
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setBuyOpen(true)}>
            Buy credits
          </button>
        </div>
        {balance === 0 && (
          <p role="note" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            You have no credits. Buy a pack to keep scanning.
          </p>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-serif text-2xl text-navy">Pricing</h2>
        <p className="mt-1 text-sm text-muted">Pay with mobile money. Credits never expire. A credit is used only when a report is produced.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {CREDIT_PACKS.map((p) => (
            <div key={p.id} className="rounded-2xl border border-line p-4 text-center">
              <p className="font-serif text-4xl text-navy">{p.credits}</p>
              <p className="text-xs text-muted">credits</p>
              <p className="mt-2 font-medium text-navy">{tsh(p.amount)}</p>
              <p className="text-xs text-muted">{tsh(Math.round(p.amount / p.credits))} per scan</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">Accepted: {NETWORKS.map((n) => n.label).join(", ")}.</p>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-serif text-2xl text-navy">Payments</h2>
        {purchases.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {purchases.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <span className="font-medium text-navy">{p.credits} credits</span>
                  <span className="text-muted">
                    {" "}
                    &middot; {tsh(p.amount)} &middot; {networkName(p.provider)}
                  </span>
                  <span className="block text-xs text-muted">{when(p.created_at)}</span>
                </span>
                <span className={`badge ${p.status === "completed" ? "badge-likely" : "badge-unlikely"}`}>{STATUS_LABEL[p.status] || p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-serif text-2xl text-navy">Credit history</h2>
        {ledger.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <span className="text-navy">{REASON_LABEL[l.reason] || l.reason}</span>
                  <span className="block text-xs text-muted">{when(l.created_at)}</span>
                </span>
                <span className={`font-medium ${l.delta > 0 ? "text-emerald-700" : "text-navy"}`}>
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
            router.refresh(); // reload the payment and history lists
          }}
          onCredits={setBalance}
        />
      )}
    </div>
  );
}
