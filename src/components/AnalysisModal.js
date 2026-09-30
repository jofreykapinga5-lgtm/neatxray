"use client";

import { useEffect, useRef, useState } from "react";
import ReportView, { reportToText } from "./ReportView";

const STAGE_TEXT = {
  uploading: "Uploading images securely",
  analyzing: "Reading the image and writing the report",
};

export default function AnalysisModal({ phase, stage, progress, error, result, rejection, onChooseAnother, onClose, onRetry, onDownload }) {
  const dialogRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const working = phase === "working";

  useEffect(() => {
    dialogRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (working) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [working, onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reportToText(result.report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const pct = Math.round(progress);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-navy/60 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !working) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-title"
        className="flex w-full max-w-3xl flex-col bg-surface outline-none sm:max-h-[92vh] sm:rounded-3xl sm:shadow-[0_30px_80px_rgba(31,53,86,0.35)] overflow-hidden"
      >
        {working && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
            <h2 id="analysis-title" className="font-serif text-2xl text-navy">
              Analyzing your scan
            </h2>
            <div className="w-full max-w-sm space-y-3">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label="Analysis progress"
                className="h-3 w-full overflow-hidden rounded-full bg-line"
              >
                <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="font-serif text-4xl text-navy" aria-hidden="true">
                {pct}%
              </p>
              <p className="text-sm text-muted" aria-live="polite">
                {STAGE_TEXT[stage] || "Working"}
              </p>
            </div>
            <p className="max-w-xs text-xs text-muted">
              This usually takes under a minute. Keep this window open. The percentage is an estimate while the AI is reading.
            </p>
          </div>
        )}

        {phase === "rejected" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
            <h2 id="analysis-title" className="font-serif text-2xl text-navy">
              This does not look like a medical image
            </h2>
            {rejection && <p className="max-w-sm text-sm text-muted">{rejection}</p>}
            <p className="max-w-sm text-sm text-muted">
              Nothing was saved and this did not count toward your daily limit. Check the file and choose an X-ray.
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn-primary" onClick={onChooseAnother}>
                Choose another image
              </button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
            <h2 id="analysis-title" className="font-serif text-2xl text-navy">
              The analysis did not finish
            </h2>
            <p role="alert" className="max-w-sm text-sm text-red-700">
              {error}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn-primary" onClick={onRetry}>
                Try again
              </button>
            </div>
          </div>
        )}

        {phase === "done" && result && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 id="analysis-title" className="font-serif text-2xl text-navy">
                Report ready
              </h2>
              <button type="button" onClick={onClose} aria-label="Close report" className="btn-ghost !px-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <ReportView report={result.report} provider={result.provider} model={result.model} hideActions />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button type="button" onClick={copy} className="btn-ghost">
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" onClick={onDownload} className="btn-primary">
                Download PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
