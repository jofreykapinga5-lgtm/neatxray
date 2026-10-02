import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { closePurchase, fulfilPurchase } from "@/lib/purchases";
import { verifyWebhook } from "@/lib/snippe";

// The payment provider calls this when a payment finishes. Anyone can reach this URL, so nothing is
// trusted until the signature checks out, and credits are only added for a purchase we created
// ourselves and only when the amount matches what we asked for.
export async function POST(request) {
  const raw = await request.text(); // the signature covers these exact bytes
  const ok = verifyWebhook(raw, request.headers.get("x-webhook-signature"), request.headers.get("x-webhook-timestamp"));
  if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  const type = event?.type;
  const orderId = event?.data?.metadata?.order_id;
  if (!type?.startsWith("payment.") || !orderId) return NextResponse.json({ received: true });

  const admin = createAdminClient();
  const { data: row } = await admin.from("credit_purchases").select("id, amount, status").eq("id", orderId).maybeSingle();
  if (!row) return NextResponse.json({ received: true }); // not one of ours

  try {
    if (type === "payment.completed") {
      if (event.data?.amount?.value !== row.amount) {
        console.error(`webhook: amount mismatch for ${orderId}: expected ${row.amount}, got ${event.data?.amount?.value}`);
        return NextResponse.json({ received: true });
      }
      await fulfilPurchase(admin, orderId);
    } else if (type === "payment.failed" || type === "payment.voided" || type === "payment.expired") {
      await closePurchase(admin, orderId, type.replace("payment.", ""));
    }
  } catch (err) {
    console.error("webhook: could not process event:", err?.message || err);
    return NextResponse.json({ error: "Try again" }, { status: 500 }); // asks the provider to retry
  }
  return NextResponse.json({ received: true });
}
