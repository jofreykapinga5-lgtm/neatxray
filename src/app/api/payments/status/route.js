import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBalance } from "@/lib/credits";
import { closePurchase, fulfilPurchase } from "@/lib/purchases";
import { getPayment } from "@/lib/snippe";
import { limitUser, tooMany } from "@/lib/rate-limit";

// The app polls this while the buyer approves the payment on their phone. If the webhook is late,
// this asks the provider directly, so credits still arrive.
export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limit = await limitUser(supabase, "status");
  if (!limit.allowed) return tooMany(limit.retryAfter);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Row-level security: a doctor can only see their own purchases.
  const { data: row } = await supabase.from("credit_purchases").select("id, status, provider_ref").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

  let status = row.status;
  if (status === "pending" && row.provider_ref) {
    try {
      const remote = await getPayment(row.provider_ref);
      const admin = createAdminClient();
      if (remote.status === "completed") {
        await fulfilPurchase(admin, id);
        status = "completed";
      } else if (["failed", "voided", "expired"].includes(remote.status)) {
        await closePurchase(admin, id, remote.status);
        status = remote.status;
      }
    } catch (err) {
      console.error("payment status check failed:", err?.message || err);
    }
  }

  const balance = status === "completed" ? await getBalance(supabase).catch(() => null) : null;
  return NextResponse.json({ status, balance });
}
