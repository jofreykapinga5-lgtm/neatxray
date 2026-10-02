"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BuyCreditsModal from "./BuyCreditsModal";
import { NETWORKS, PRICE_PER_CREDIT, tsh } from "@/lib/credit-packs";

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

function StatCard({ label, children, action, note }) {
  return (
    <section className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm text-muted">{label}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
      {note && <p className="mt-2 text-sm text-muted">{note}</p>}
    </section>
  );
}

export default function BillingClient({ initialBalance, scanCost, stats, purchases, ledger }) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [buyOpen, setBuyOpen] = useState(false);
  const peak = Math.max(1, ...stats.last7.map((d) => d.count));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Credits remaining"
          action={
            <button type="button" onClick={() => setBuyOpen(true)} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-bg">
              Add credits
            </button>
          }
          note={balance === 0 ? "You have no credits. Add some to keep scanning." : `${scanCost} ${scanCost === 1 ? "credit" : "credits"} per scan`}
        >
          <p className="text-4xl font-bold tracking-tight text-navy">{balance}</p>
        </StatCard>

        <StatCard label="Used this month" note={`${tsh(PRICE_PER_CREDIT)} per credit`}>
          <p className="text-4xl font-bold tracking-tight text-navy">
            {stats.scansThisMonth} <span className="text-lg font-medium text-muted">{stats.scansThisMonth === 1 ? "scan" : "scans"}</span>
          </p>
        </StatCard>

        <StatCard label="Credits bought" note={stats.totalTsh > 0 ? `${tsh(stats.totalTsh)} paid in total` : "No purchases yet"}>
          <p className="text-4xl font-bold tracking-tight text-navy">{stats.creditsBought}</p>
        </StatCard>

        <StatCard label="Scans, last 7 days" note={`${stats.last7.reduce((n, d) => n + d.count, 0)} in total`}>
          <div className="flex h-14 items-end gap-2" role="img" aria-label={`Scans per day for the last 7 days: ${stats.last7.map((d) => d.count).join(", ")}`}>
            {stats.last7.map((d) => (
              <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end" title={`${d.day}: ${d.count}`}>
                <div className="w-full max-w-[1.75rem] rounded-sm bg-accent" style={{ height: `${Math.max(d.count ? 12 : 4, (d.count / peak) * 100)}%`, opacity: d.count ? 1 : 0.25 }} />
              </div>
            ))}
          </div>
        </StatCard>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-navy">Payments</h2>
        {purchases.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {purchases.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3 text-sm">
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

      <section id="history" className="scroll-mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-navy">Usage</h2>
        {ledger.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-6 py-3 text-sm">
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
          balance={balance}
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
