"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";

// Reached from the reset link in the email. The link signs the doctor in, then they choose a new password.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("We could not change your password. The link may have expired; request a new one.");
      setBusy(false);
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  return (
    <AuthShell title="Choose a new password" subtitle="You will be signed in right after.">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="text-navy">New password</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field mt-1" />
          <span className="mt-1 block text-xs text-muted">At least 8 characters.</span>
        </label>
        <label className="block text-sm">
          <span className="text-navy">Confirm new password</span>
          <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="field mt-1" />
        </label>
        {error && (
          <p role="alert" className="text-center text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </AuthShell>
  );
}
