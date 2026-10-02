"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";
import GoogleButton from "@/components/GoogleButton";
import PasswordField from "@/components/PasswordField";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(/registered|already/i.test(error.message) ? "An account with this email already exists. Try signing in." : error.message);
      setBusy(false);
      return;
    }
    if (data.session) {
      // Email confirmation is switched off in Supabase: the account is ready straight away.
      router.replace("/app");
      router.refresh();
      return;
    }
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`We sent a confirmation link to ${email}. Open it to finish creating your account and get your 5 free scans.`}
        footer={
          <>
            Already confirmed?{" "}
            <Link href="/login" className="font-semibold text-navy underline underline-offset-4">
              Sign in
            </Link>
          </>
        }
      >
        <p className="text-center text-sm text-muted">Can&apos;t find it? Look in your spam folder.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your first 5 scans are free."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-navy underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <GoogleButton label="Sign up with Google" onError={setError} />

        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          or with email
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5">
          <label className="block text-sm">
            <span className="text-navy">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field-pill mt-1" />
          </label>
          <PasswordField
            label="Password"
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 8 characters."
          />
          <PasswordField label="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && (
            <p role="alert" className="text-center text-sm text-red-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary auth-btn w-full">
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
