import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp, limitKey, tooMany } from "@/lib/rate-limit";

// Email + password sign-in, run on our server so guessing passwords can be limited.
export async function POST(request) {
  const { email, password } = await request.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }
  const address = email.trim().toLowerCase().slice(0, 200);

  // Every attempt counts, right or wrong: 10 per email and 40 per network every 15 minutes.
  const perEmail = await limitKey(`login:email:${address}`, 10, 900);
  if (!perEmail.allowed) return tooMany(perEmail.retryAfter, "Too many sign-in attempts for this account.");
  const perIp = await limitKey(`login:ip:${clientIp(request)}`, 40, 900);
  if (!perIp.allowed) return tooMany(perIp.retryAfter, "Too many sign-in attempts from this network.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: address, password });
  if (error) {
    const unconfirmed = /confirm/i.test(error.message);
    return NextResponse.json(
      {
        code: unconfirmed ? "unconfirmed" : "invalid",
        error: unconfirmed
          ? "Please confirm your email first. We sent you a link when you created your account."
          : "Sign-in failed. Check your email and password.",
      },
      { status: 401 }
    );
  }
  return NextResponse.json({ ok: true });
}
