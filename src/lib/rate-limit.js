import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Shared rate limits, kept in the database so they hold across all of Vercel's servers.
// If the limiter itself is unavailable (tables not created yet, service key missing) it logs and lets the
// request through, so a limiter problem never takes the whole site down. Run supabase/rate-limit.sql to switch it on.

let warned = false;
function warnOnce(message) {
  if (warned) return;
  warned = true;
  console.error(`rate-limit disabled: ${message}`);
}

function parse(data) {
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: row?.allowed !== false, retryAfter: row?.retry_after ?? 0 };
}

// The caller's address as seen by Vercel (it sets x-forwarded-for itself, so the first entry is the real client).
export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return ip.slice(0, 64);
}

// Per signed-in doctor. The numbers live in supabase/rate-limit.sql so a doctor cannot loosen their own limit.
export async function limitUser(supabase, bucket) {
  const { data, error } = await supabase.rpc("rate_limit_user", { p_bucket: bucket });
  if (error) {
    warnOnce(error.message);
    return { allowed: true, retryAfter: 0 };
  }
  return parse(data);
}

// Per anything else (address, email, phone, whole site). Server only.
export async function limitKey(key, limit, windowSeconds) {
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_key", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return parse(data);
  } catch (err) {
    warnOnce(err?.message || String(err));
    return { allowed: true, retryAfter: 0 };
  }
}

export function waitText(seconds) {
  if (seconds < 90) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 90 ? `${minutes} minutes` : `${Math.ceil(minutes / 60)} hours`;
}

export function tooMany(retryAfter, message = "Too many requests.") {
  return NextResponse.json(
    { error: `${message} Please try again in ${waitText(retryAfter)}.`, code: "rate_limited", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
