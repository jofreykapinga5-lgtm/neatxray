"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (error) return setError("We could not send the email. Please try again in a moment.");
    setSent(true); // same message whether or not the address has an account, so nobody can probe for accounts
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle={sent ? null : "Enter your email and we will send you a link to choose a new password."}
      footer={
        <Link href="/login" className="font-semibold text-navy underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="text-center text-sm text-muted">
          If an account exists for {email}, a reset link is on its way. Check your inbox and spam folder.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3.5">
          <label className="block text-sm">
            <span className="text-navy">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field-pill mt-1" />
          </label>
          {error && (
            <p role="alert" className="text-center text-sm text-red-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary auth-btn w-full">
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
