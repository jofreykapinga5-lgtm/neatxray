"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Sign-in failed. Check your email and password.");
      setBusy(false);
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm card p-8 space-y-5">
        <div>
          <h1 className="sr-only">Sign in to neatx-ray</h1>
          <Link href="/" aria-label="neatx-ray home"><Logo size={36} /></Link>
          <p className="text-sm text-muted mt-1">AI decision support for doctors. Sign in to continue.</p>
        </div>
        <label className="block text-sm">
          <span className="text-navy">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field mt-1"
          />
        </label>
        <label className="block text-sm">
          <span className="text-navy">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field mt-1"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-xs text-muted">Access is by invitation only.</p>
      </form>
    </main>
  );
}
