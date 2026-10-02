// Credits: 1 credit = 1 scan. Everything is checked and charged on the server.
// Off until CREDITS_ENABLED=true, so the code can ship before the database tables exist.
export const CREDITS_ENABLED = process.env.CREDITS_ENABLED === "true";
export const SCAN_COST = Number(process.env.SCAN_CREDIT_COST || 1);
export const COMPARE_COST = Number(process.env.COMPARE_CREDIT_COST || 5);
export const OUT_OF_CREDITS = `You are out of credits. ${process.env.CREDITS_HELP_TEXT || "Buy more credits to continue."}`;

// Own balance only: row-level security hides everyone else's. No row yet means zero.
export async function getBalance(supabase) {
  const { data, error } = await supabase.from("credit_balances").select("balance").maybeSingle();
  if (error) throw error;
  return data?.balance ?? 0;
}

// Returns { ok: true, balance } or { ok: false } when there are not enough credits.
// Passing the same ref again never charges twice.
export async function charge(supabase, amount, reason, ref) {
  const { data, error } = await supabase.rpc("spend_credits", { p_amount: amount, p_reason: reason, p_ref: ref });
  if (error) {
    if (/insufficient_credits/.test(error.message)) return { ok: false };
    throw error;
  }
  return { ok: true, balance: data };
}
