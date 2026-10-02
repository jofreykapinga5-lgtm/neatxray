import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CREDITS_ENABLED } from "@/lib/credits";
import { MAX_CREDITS, MIN_CREDITS, NETWORKS, resolvePurchase } from "@/lib/credit-packs";
import { closePurchase } from "@/lib/purchases";
import { createMobilePayment, normalizePhone } from "@/lib/snippe";

// Starts a purchase: the buyer's phone gets a prompt to approve the payment.
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!CREDITS_ENABLED) return NextResponse.json({ error: "Credits are not enabled." }, { status: 400 });

  const { packId, credits, provider, phone } = await request.json().catch(() => ({}));
  const pack = resolvePurchase(packId, credits);
  if (!pack) {
    return NextResponse.json({ error: `Choose a pack, or enter between ${MIN_CREDITS} and ${MAX_CREDITS} credits.` }, { status: 400 });
  }
  if (!NETWORKS.some((n) => n.id === provider)) return NextResponse.json({ error: "Choose a mobile money network." }, { status: 400 });
  const normalized = normalizePhone(phone);
  if (!normalized) return NextResponse.json({ error: "Enter a valid Tanzanian phone number, for example 0712 345 678." }, { status: 400 });

  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const { error: insertError } = await admin
    .from("credit_purchases")
    .insert({ id, user_id: user.id, pack_id: pack.id, credits: pack.credits, amount: pack.amount, provider });
  if (insertError) {
    console.error("checkout: could not record purchase:", insertError.message);
    return NextResponse.json({ error: "Could not start the payment. Please try again." }, { status: 503 });
  }

  try {
    const payment = await createMobilePayment({
      amount: pack.amount,
      provider,
      phone: normalized,
      email: user.email,
      metadata: { order_id: id, user_id: user.id, pack_id: pack.id },
    });
    await admin.from("credit_purchases").update({ provider_ref: payment.reference ?? payment.id, status: "pending" }).eq("id", id);
    return NextResponse.json({ purchaseId: id });
  } catch (err) {
    console.error("checkout: provider rejected the payment:", err?.message || err);
    await closePurchase(admin, id, "failed");
    return NextResponse.json({ error: err?.message || "The payment could not be started." }, { status: 502 });
  }
}
