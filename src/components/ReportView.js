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

// Reports saved before the short format have no impression; they keep the longer layout.
const isCompact = (r) => Boolean(r.impression);

export function reportToText(r) {
  let lines;
  if (isCompact(r)) {
    const d = r.details || {};
    lines = [`Impression (${LABELS[r.confidence] || r.confidence}): ${r.impression}`, `Region / view: ${r.region_and_view}`];
    if (r.key_findings?.length) lines.push("", "Key findings:", ...r.key_findings.map((o) => `- ${o}`));
    if (r.next_steps?.length) lines.push("", "Next steps:", ...r.next_steps.map((o) => `- ${o}`));
    const more = [
      d.image_quality ? `Image quality: ${d.image_quality}` : "",
      ...(d.also_considered || []).map((o) => `Also considered: ${o}`),
      ...(d.limitations || []).map((o) => `Limitation: ${o}`),
    ].filter(Boolean);
    if (more.length) lines.push("", "More detail:", ...more.map((o) => `- ${o}`));
    if (r.urgency === "urgent") lines.splice(0, 0, `URGENT: ${r.urgency_reason}`, "");
    else if (r.urgency === "soon") lines.splice(0, 0, `NEEDS ATTENTION SOON: ${r.urgency_reason}`, "");
  } else {
    lines = [
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
    if (r.urgent_attention) lines.splice(0, 0, `URGENT: ${r.urgent_reason}`, "");
  }
  if (r.image_type === "other_medical") {
    lines.splice(0, 0, `NOTE: Not a plain X-ray; this tool is built for X-rays, so reliability is lower. ${r.image_type_note || ""}`.trim(), "");
  }
  return lines.join("\n");
}

function CompactBody({ report }) {
  const d = report.details || {};
  const hasMore = d.image_quality || d.also_considered?.length || d.limitations?.length;

  return (
    <>
      {report.urgency === "urgent" && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <strong>Urgent.</strong> {report.urgency_reason}
        </div>
      )}
      {report.urgency === "soon" && (
        <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Needs attention soon.</strong> {report.urgency_reason}
        </div>
      )}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge badge-${report.confidence}`}>{LABELS[report.confidence]}</span>
          <span className="text-sm text-muted">{report.region_and_view}</span>
        </div>
        <h3 className="font-serif text-xl leading-snug text-navy sm:text-2xl">{report.impression}</h3>
      </section>

      {report.key_findings?.length > 0 && (
        <Section title="Key findings">
          <List items={report.key_findings} />
        </Section>
      )}

      {report.next_steps?.length > 0 && (
        <Section title="Next steps">
          <List items={report.next_steps} />
        </Section>
      )}

      {hasMore && (
        <details className="rounded-xl border border-line px-4">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-navy">
            More detail
            <span className="text-lg leading-none text-muted" aria-hidden="true">+</span>
          </summary>
          <div className="space-y-3 pb-4 text-sm">
            {d.image_quality && (
              <p>
                <span className="font-medium">Image quality: </span>
                {d.image_quality}
              </p>
            )}
            {d.also_considered?.length > 0 && (
              <div>
                <p className="font-medium">Also considered</p>
                <List items={d.also_considered} />
              </div>
            )}
            {d.limitations?.length > 0 && (
              <div>
                <p className="font-medium">Limitations</p>
                <List items={d.limitations} />
              </div>
            )}
          </div>
        </details>
      )}
    </>
  );
}

function LegacyBody({ report }) {
  return (
    <>
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
    </>
  );
}

export default function ReportView({ report, onDownload, hideActions = false }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reportToText(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="report-cascade space-y-5">
      {report.image_type === "other_medical" && (
        <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>This is not a plain X-ray.</strong> neatx-ray is built for X-rays, so this read may be less reliable.{" "}
          {report.image_type_note}
        </div>
      )}

      {isCompact(report) ? <CompactBody report={report} /> : <LegacyBody report={report} />}

      {!hideActions && (
        <div className="flex justify-end gap-2 pt-2">
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
  );
}
