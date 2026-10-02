import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CREDITS_ENABLED, SCAN_COST, getBalance } from "@/lib/credits";
import Logo from "@/components/Logo";
import BillingClient from "@/components/BillingClient";

export const metadata = { title: "Billing" };

const EAT_MS = 3 * 60 * 60 * 1000; // Tanzania is UTC+3; count days and months the way the doctor sees them
const currentTime = () => Date.now();
const dayOf = (iso) => new Date(new Date(iso).getTime() + EAT_MS).toISOString().slice(0, 10);

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!CREDITS_ENABLED) redirect("/app");

  // Row-level security limits every query below to this doctor's own rows.
  const [balance, purchases, ledger] = await Promise.all([
    getBalance(supabase).catch(() => 0),
    supabase
      .from("credit_purchases")
      .select("id, credits, amount, provider, status, created_at")
      .neq("status", "creating")
      .order("created_at", { ascending: false })
      .limit(50)
      .then((r) => r.data || []),
    supabase
      .from("credit_ledger")
      .select("id, delta, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(500)
      .then((r) => r.data || []),
  ]);

  const nowEat = new Date(currentTime() + EAT_MS);
  const month = nowEat.toISOString().slice(0, 7);
  const scans = ledger.filter((l) => l.reason === "scan" && l.delta < 0);
  const paid = purchases.filter((p) => p.status === "completed");
  const stats = {
    scansThisMonth: scans.filter((l) => dayOf(l.created_at).startsWith(month)).length,
    creditsBought: paid.reduce((n, p) => n + p.credits, 0),
    totalTsh: paid.reduce((n, p) => n + p.amount, 0),
    last7: Array.from({ length: 7 }, (_, i) => {
      const day = new Date(nowEat.getTime() - (6 - i) * 86_400_000).toISOString().slice(0, 10);
      return { day, count: scans.filter((l) => dayOf(l.created_at) === day).length };
    }),
  };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <h1>
          <Link href="/app" aria-label="neatx-ray home">
            <Logo size={34} />
          </Link>
        </h1>
        <Link href="/app" className="inline-flex min-h-[44px] items-center text-sm font-medium text-navy underline underline-offset-4">
          Back to scans
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-4 sm:px-6">
        <h2 className="mb-6 text-3xl font-bold tracking-tight text-navy">Billing</h2>
        <BillingClient initialBalance={balance} scanCost={SCAN_COST} stats={stats} purchases={purchases} ledger={ledger.slice(0, 30)} />
      </main>
    </div>
  );
}
