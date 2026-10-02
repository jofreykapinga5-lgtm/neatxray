import crypto from "node:crypto";

const BASE = "https://api.snippe.sh";

async function call(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.PAYMENT_API_KEY}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.message || body?.error?.message || body?.error || `Payment provider answered ${res.status}`;
    throw new Error(typeof message === "string" ? message : "The payment provider rejected the request.");
  }
  return body.data ?? body;
}

// Accepts 07XXXXXXXX, 7XXXXXXXX, 2557XXXXXXXX or +2557XXXXXXXX. Returns +255XXXXXXXXX or null.
export function normalizePhone(input) {
  const digits = String(input || "").replace(/[^\d]/g, "");
  let national = null;
  if (digits.startsWith("255") && digits.length === 12) national = digits.slice(3);
  else if (digits.startsWith("0") && digits.length === 10) national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  return national && /^[67]\d{8}$/.test(national) ? `+255${national}` : null;
}

// Sends the customer a prompt on their phone to approve the payment.
export async function createMobilePayment({ amount, provider, phone, email, metadata }) {
  const key = crypto.randomUUID().replace(/-/g, "").slice(0, 28); // the provider rejects keys over 30 characters
  return call("/v1/payments", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify({
      payment_type: "mobile",
      amount: { currency: "TZS", value: amount },
      channel: { type: "mobile_money", provider },
      customer: { phone, email, first_name: "Doctor", last_name: "neatx-ray" },
      metadata,
    }),
  });
}

export function getPayment(reference) {
  return call(`/v1/payments/${encodeURIComponent(reference)}`);
}

// The provider signs "<timestamp>.<raw body>" with HMAC-SHA256 (hex) using our webhook secret.
export function verifyWebhook(rawBody, signature, timestamp) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signature || !timestamp) return false;
  let ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (ts > 1e12) ts = Math.floor(ts / 1000); // tolerate milliseconds
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false; // reject anything older than 5 minutes
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature).trim().toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
