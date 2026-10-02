"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";
import PasswordField from "@/components/PasswordField";

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
        <PasswordField
          label="New password"
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters."
        />
        <PasswordField label="Confirm new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && (
          <p role="alert" className="text-center text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary auth-btn w-full">
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </AuthShell>
  );
}
