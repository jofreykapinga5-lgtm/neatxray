import { createClient } from "@supabase/supabase-js";

// Server-only client that bypasses row-level security. Used for payments, where no doctor is signed in
// (the provider's webhook) and for writing the credit tables. Never import this from a client component.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
