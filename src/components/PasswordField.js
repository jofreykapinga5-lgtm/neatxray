"use client";

import { useId, useState } from "react";

// A password box with an eye button to show or hide what was typed.
export default function PasswordField({ label, value, onChange, autoComplete, minLength, hint, labelRight }) {
  const id = useId();
  const [show, setShow] = useState(false);

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-navy">
          {label}
        </label>
        {labelRight}
      </div>
      <div className="relative mt-1">
        <input
          id={id}
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className="field-pill"
          style={{ paddingRight: "3rem" }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-full text-muted hover:text-navy"
        >
          {show ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9.9 4.24A9.1 9.1 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.1 4.1M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.2-.9" />
              <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" />
              <path d="M2 2l20 20" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </div>
  );
}
