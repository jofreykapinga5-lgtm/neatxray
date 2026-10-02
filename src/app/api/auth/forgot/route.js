import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp, limitKey, tooMany } from "@/lib/rate-limit";

// Password-reset emails, run on our server so nobody can use it to flood an inbox.
export async function POST(request) {
  const { email } = await request.json().catch(() => ({}));
  if (typeof email !== "string" || !email.trim()) return NextResponse.json({ error: "Enter your email." }, { status: 400 });
  const address = email.trim().toLowerCase().slice(0, 200);

  const perEmail = await limitKey(`forgot:email:${address}`, 3, 3600);
  if (!perEmail.allowed) return tooMany(perEmail.retryAfter, "A reset link was already sent to this email.");
  const perIp = await limitKey(`forgot:ip:${clientIp(request)}`, 10, 3600);
  if (!perIp.allowed) return tooMany(perIp.retryAfter, "Too many reset requests from this network.");

  const origin = process.env.SITE_URL || new URL(request.url).origin;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  if (error) console.error("forgot: reset email failed:", error.message);
  // Same answer whether or not the address has an account, so nobody can use this to find out who is registered.
  return NextResponse.json({ ok: true });
}
