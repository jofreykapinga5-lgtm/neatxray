import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where Google sign-in, email confirmation links and password-reset links land.
// They arrive with a one-time code that we trade for a session.
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  // Only follow paths inside this site, never an address someone put in the link.
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
