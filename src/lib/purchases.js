// Marks a purchase paid and adds its credits. Safe to run more than once for the same purchase:
// grant_credits ignores a reference it has already applied, so the webhook and the status check can race.
export async function fulfilPurchase(admin, id) {
  const { data: row } = await admin.from("credit_purchases").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  if (row.status !== "completed") {
    const { error } = await admin.rpc("grant_credits", {
      p_user: row.user_id,
      p_amount: row.credits,
      p_reason: "purchase",
      p_ref: `purchase:${id}`,
    });
    if (error) throw error;
    await admin.from("credit_purchases").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
  }
  return row;
}

export async function closePurchase(admin, id, status) {
  await admin.from("credit_purchases").update({ status }).eq("id", id).in("status", ["creating", "pending"]);
}
