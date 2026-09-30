"use client";

import { useState } from "react";

const LABELS = { likely: "Likely", possible: "Possible", unlikely: "Unlikely" };

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="font-serif text-lg text-navy">{title}</h3>
      {children}
    </section>
  );
}

function List({ items }) {
  if (!items?.length) return <p className="text-sm text-muted">None noted.</p>;
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

export function reportToText(r) {
  const lines = [
    "neatx-ray AI decision support - not a diagnosis",
    "",
    `Region / view: ${r.region_and_view}`,
    `Image quality: ${r.image_quality.adequate ? "Adequate" : "Limited"}. ${r.image_quality.notes}`,
    "",
    "Observations:",
    ...r.observations.map((o) => `- ${o}`),
    "",
    "Possible findings:",
    ...r.findings.map((f) => `- [${LABELS[f.confidence]}] ${f.finding} (${f.location}): ${f.reasoning}`),
    "",
    "Suggested follow-up:",
    ...r.suggested_followup.map((o) => `- ${o}`),
    "",
    "Limitations:",
    ...r.limitations.map((o) => `- ${o}`),
  ];
  if (r.urgent_attention) lines.splice(2, 0, `URGENT: ${r.urgent_reason}`);
  return lines.join("\n");
}

export default function ReportView({ report, provider, model, onDownload, hideActions = false }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reportToText(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="space-y-5">
      {report.urgent_attention && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <strong>Possible urgent finding.</strong> {report.urgent_reason}
        </div>
      )}

      <Section title="Region and view">
        <p className="text-sm">{report.region_and_view}</p>
        <p className="text-sm text-muted">
          Image quality: {report.image_quality.adequate ? "adequate" : "limited"}. {report.image_quality.notes}
        </p>
      </Section>

      <Section title="Observations">
        <List items={report.observations} />
      </Section>

      <Section title="Possible findings">
        {report.findings.length === 0 ? (
          <p className="text-sm text-muted">No findings reported.</p>
        ) : (
          <ul className="space-y-3">
            {report.findings.map((f, i) => (
              <li key={i} className="rounded-xl border border-line p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge badge-${f.confidence}`}>{LABELS[f.confidence]}</span>
                  <strong>{f.finding}</strong>
                  <span className="text-muted">· {f.location}</span>
                </div>
                <p className="text-muted">{f.reasoning}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Suggested follow-up">
        <List items={report.suggested_followup} />
      </Section>

      <Section title="Limitations">
        <List items={report.limitations} />
      </Section>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <span className="text-xs text-muted">
          {provider} · {model}
        </span>
        {!hideActions && (
          <div className="flex gap-2">
            {onDownload && (
              <button type="button" onClick={onDownload} className="btn-primary">
                Download PDF
              </button>
            )}
            <button type="button" onClick={copy} className="btn-ghost">
              {copied ? "Copied" : "Copy report"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
