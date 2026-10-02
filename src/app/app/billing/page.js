import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CREDITS_ENABLED, SCAN_COST, getBalance } from "@/lib/credits";
import Logo from "@/components/Logo";
import BillingClient from "@/components/BillingClient";

export const metadata = { title: "Billing" };

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
      .limit(20)
      .then((r) => r.data || []),
    supabase
      .from("credit_ledger")
      .select("id, delta, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(30)
      .then((r) => r.data || []),
  ]);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <h1>
          <Link href="/app" aria-label="neatx-ray home">
            <Logo size={34} />
          </Link>
        </h1>
        <Link href="/app" className="btn-ghost">
          Back to scans
        </Link>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <BillingClient initialBalance={balance} scanCost={SCAN_COST} email={user.email} purchases={purchases} ledger={ledger} />
      </main>
    </div>
  );
}
