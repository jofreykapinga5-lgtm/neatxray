"use client";

import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { COMPARE_MODELS, MEDGEMMA_MODEL } from "@/lib/ai/models";

const LABELS = { likely: "Likely", possible: "Possible", unlikely: "Unlikely" };

const money = (n) => `$${n < 0.001 ? n.toFixed(4) : n.toFixed(3)}`;

function Bullets({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function ModelCard({ m, cheapest }) {
  const r = m.report;
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface">
      <header className="flex items-start justify-between gap-2 border-b border-line p-4">
        <div>
          <h3 className="font-semibold text-navy">{m.name}</h3>
          <p className="text-xs text-muted">{m.note}</p>
        </div>
        {cheapest && <span className="badge badge-likely shrink-0">Lowest cost</span>}
      </header>

      <div className="flex-1 space-y-3 p-4">
        {m.ok ? (
          <>
            {r.urgency === "urgent" && (
              <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
                <strong>Urgent.</strong> {r.urgency_reason}
              </p>
            )}
            {r.urgency === "soon" && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <strong>Needs attention soon.</strong> {r.urgency_reason}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge badge-${r.confidence}`}>{LABELS[r.confidence]}</span>
              <span className="text-xs text-muted">{r.region_and_view}</span>
            </div>
            <p className="font-serif text-lg leading-snug text-navy">{r.impression}</p>
            {r.key_findings?.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-navy">Key findings</p>
                <Bullets items={r.key_findings} />
              </div>
            )}
            {r.next_steps?.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-navy">Next steps</p>
                <Bullets items={r.next_steps} />
              </div>
            )}
          </>
        ) : (
          <p role="alert" className="text-sm text-red-700">
            {m.error}
          </p>
        )}
      </div>

      <footer className="rounded-b-2xl border-t border-line bg-bg p-4 text-sm">
        <p className="font-semibold text-navy">
          {m.perHour ? `Price: $${m.perHour} per GPU hour (our own server)` : `Price: $${m.inputPerMTok} in, $${m.outputPerMTok} out per million tokens`}
        </p>
        {m.ok && (
          <p className="mt-1 text-muted">
            This scan cost <strong className="text-navy">{money(m.cost)}</strong> · {m.seconds} s ·{" "}
            {m.tokens.input.toLocaleString()} in / {m.tokens.output.toLocaleString()} out tokens
          </p>
        )}
      </footer>
    </article>
  );
}

export default function CompareModal({ caseId, onClose }) {
  const dialogRef = useRef(null);
  const [phase, setPhase] = useState("loading"); // loading | done | error
  const [models, setModels] = useState([]);
  const [error, setError] = useState("");

  useDialogFocus(dialogRef, () => {
    if (phase !== "loading") onClose();
  });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId }),
          signal: controller.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "The comparison failed.");
        setModels(body.models);
        setPhase("done");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err.message || "The comparison failed.");
        setPhase("error");
      }
    })();
    return () => controller.abort();
  }, [caseId]);

  const ok = models.filter((m) => m.ok);
  const cheapestId = ok.length ? ok.reduce((a, b) => (b.cost < a.cost ? b : a)).id : null;
  const total = ok.reduce((sum, m) => sum + m.cost, 0);

  return (
    <div
      className="motion-fade fixed inset-0 z-50 flex items-stretch justify-center bg-navy/60 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== "loading") onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        className="motion-sheet flex w-full max-w-6xl flex-col overflow-hidden bg-bg outline-none sm:max-h-[94vh] sm:rounded-3xl sm:shadow-[0_30px_80px_rgba(31,53,86,0.35)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-4">
          <h2 id="compare-title" className="font-serif text-2xl text-navy">
            Compare models
          </h2>
          <button type="button" onClick={onClose} aria-label="Close comparison" className="btn-ghost !px-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <p className="mb-4 max-w-3xl text-sm text-navy/80">
            The same film and the same instructions, answered by several models. Prices are what each model charges per
            million tokens; &ldquo;This scan cost&rdquo; is what this run actually used. A cheaper model is only worth it if its
            answer matches your own reading.
          </p>

          {phase === "loading" && (
            <div className="space-y-4 py-6" aria-live="polite">
              <p className="font-serif text-xl text-navy">Asking the models&hellip; this takes about a minute.</p>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[...COMPARE_MODELS, MEDGEMMA_MODEL].map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                    <span className="font-medium text-navy">{m.name}</span>
                    <span className="text-muted">{m.perHour ? `$${m.perHour}/hr` : `$${m.inputPerMTok} / $${m.outputPerMTok}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-4 py-6">
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
              <button type="button" className="btn-ghost" onClick={onClose}>
                Close
              </button>
            </div>
          )}

          {phase === "done" && (
            <>
              <p className="mb-4 text-sm text-muted">
                All {ok.length} answers together cost <strong className="text-navy">{money(total)}</strong> to produce.
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {models.map((m) => (
                  <ModelCard key={m.id} m={m} cheapest={m.id === cheapestId} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
