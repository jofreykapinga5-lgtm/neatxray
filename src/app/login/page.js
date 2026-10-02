"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";
import GoogleButton from "@/components/GoogleButton";
import PasswordField from "@/components/PasswordField";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") === "link" ? "That link has expired or was already used. Please sign in, or request a new one." : "");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        /confirm/i.test(error.message)
          ? "Please confirm your email first. We sent you a link when you created your account."
          : "Sign-in failed. Check your email and password."
      );
      setBusy(false);
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to read your next film."
      footer={
        <>
          New to neatx-ray?{" "}
          <Link href="/signup" className="font-semibold text-navy underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <GoogleButton onError={setError} />

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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            labelRight={
              <Link href="/forgot-password" className="text-xs font-medium text-muted underline underline-offset-4 hover:text-navy">
                Forgot password?
              </Link>
            }
          />
          {error && (
            <p role="alert" className="text-center text-sm text-red-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary auth-btn w-full">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
