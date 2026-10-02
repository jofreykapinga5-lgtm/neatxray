import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp, limitKey, tooMany } from "@/lib/rate-limit";

// Account creation, run on our server so mass sign-ups (and the confirmation emails they trigger) can be limited.
export async function POST(request) {
  const { email, password } = await request.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Enter your email and a password." }, { status: 400 });
  }
  if (password.length < 8) return NextResponse.json({ error: "Use a password with at least 8 characters." }, { status: 400 });
  const address = email.trim().toLowerCase().slice(0, 200);

  const perIp = await limitKey(`signup:ip:${clientIp(request)}`, 5, 3600);
  if (!perIp.allowed) return tooMany(perIp.retryAfter, "Too many accounts created from this network.");
  const perEmail = await limitKey(`signup:email:${address}`, 3, 3600);
  if (!perEmail.allowed) return tooMany(perEmail.retryAfter, "Too many sign-up attempts for this email.");

  const origin = process.env.SITE_URL || new URL(request.url).origin;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: address,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    const exists = /registered|already/i.test(error.message);
    return NextResponse.json(
      { error: exists ? "An account with this email already exists. Try signing in." : "We could not create the account. Please check the details and try again." },
      { status: exists ? 409 : 400 }
    );
  }
  // A session means email confirmation is switched off in Supabase and the account is ready now.
  return NextResponse.json({ ok: true, signedIn: Boolean(data.session) });
}
