// Browser-only: builds and downloads a PDF copy of an AI report.

const LABELS = { likely: "Likely", possible: "Possible", unlikely: "Unlikely" };
const NAVY = [31, 53, 86];
const MUTED = [93, 113, 134];
const ACCENT = [15, 138, 166];

// jsPDF's built-in fonts only cover Latin-1, so normalise punctuation and drop the rest.
function clean(text) {
  return String(text ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/·/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, "");
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const scale = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ data: canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function downloadReportPdf({ report, meta = {}, imageUrl }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const width = pageW - margin * 2;
  let y = margin;

  const ensure = (needed) => {
    if (y + needed > pageH - 18) {
      doc.addPage();
      y = margin;
    }
  };

  const write = (text, { size = 10, style = "normal", color = NAVY, indent = 0, gap = 1.5 } = {}) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(clean(text), width - indent);
    const lineH = size * 0.42;
    for (const line of lines) {
      ensure(lineH);
      doc.text(line, margin + indent, y + lineH * 0.8);
      y += lineH;
    }
    y += gap;
  };

  const heading = (text) => {
    ensure(12);
    y += 3;
    write(text, { size: 12.5, style: "bold", color: NAVY, gap: 1 });
  };

  const bullets = (items) => {
    if (!items?.length) return write("None noted.", { color: MUTED });
    for (const item of items) {
      ensure(6);
      doc.setFillColor(...ACCENT);
      doc.circle(margin + 1.2, y + 2.3, 0.6, "F");
      write(item, { indent: 4, gap: 1 });
    }
  };

  // Header
  write("neatx-ray", { size: 20, style: "bold", gap: 0 });
  const when = meta.createdAt ? new Date(meta.createdAt) : new Date();
  write(`Generated ${when.toLocaleString()}`, { size: 9, color: MUTED, gap: 1 });
  if (meta.label) write(`Case: ${meta.label}`, { size: 10, style: "bold", gap: 1 });

  if (report.image_type === "other_medical") {
    ensure(14);
    y += 2;
    const noteText = clean(
      `Not a plain X-ray. neatx-ray is built for X-rays, so this read may be less reliable. ${report.image_type_note || ""}`
    );
    const noteLines = doc.splitTextToSize(noteText, width - 6);
    const noteH = noteLines.length * 4.6 + 5;
    doc.setDrawColor(214, 158, 46);
    doc.setFillColor(255, 247, 222);
    doc.roundedRect(margin, y, width, noteH, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(122, 82, 0);
    doc.text(noteLines, margin + 3, y + 6);
    y += noteH + 3;
  }

  if (!report.impression && report.urgent_attention) {
    ensure(16);
    y += 2;
    doc.setDrawColor(200, 60, 60);
    doc.setFillColor(253, 236, 236);
    const boxLines = doc.splitTextToSize(clean(`Possible urgent finding: ${report.urgent_reason}`), width - 6);
    const boxH = boxLines.length * 4.6 + 5;
    doc.roundedRect(margin, y, width, boxH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(140, 30, 30);
    doc.text(boxLines, margin + 3, y + 6);
    y += boxH + 3;
  }

  // Answer first (short report format)
  if (report.impression) {
    if (report.urgency === "urgent" || report.urgency === "soon") {
      const urgent = report.urgency === "urgent";
      ensure(16);
      y += 2;
      doc.setDrawColor(...(urgent ? [200, 60, 60] : [214, 158, 46]));
      doc.setFillColor(...(urgent ? [253, 236, 236] : [255, 247, 222]));
      const boxLines = doc.splitTextToSize(clean(`${urgent ? "Urgent" : "Needs attention soon"}: ${report.urgency_reason}`), width - 6);
      const boxH = boxLines.length * 4.6 + 5;
      doc.roundedRect(margin, y, width, boxH, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...(urgent ? [140, 30, 30] : [122, 82, 0]));
      doc.text(boxLines, margin + 3, y + 6);
      y += boxH + 3;
    }
    heading("Impression");
    write(report.impression, { size: 12.5, style: "bold", gap: 1 });
    write(`${LABELS[report.confidence] || report.confidence}. ${report.region_and_view}`, { color: MUTED });
    if (report.key_findings?.length) {
      heading("Key findings");
      bullets(report.key_findings);
    }
    if (report.next_steps?.length) {
      heading("Next steps");
      bullets(report.next_steps);
    }
  }

  // Patient context
  const ctx = [];
  if (meta.age !== null && meta.age !== undefined && meta.age !== "") ctx.push(`Age: ${meta.age}`);
  if (meta.sex) ctx.push(`Sex: ${meta.sex}`);
  if (meta.symptoms) ctx.push(`Main symptoms: ${meta.symptoms}`);
  if (meta.history) ctx.push(`Relevant history: ${meta.history}`);
  if (meta.question) ctx.push(`Clinical question: ${meta.question}`);
  if (meta.notes) ctx.push(`Notes: ${meta.notes}`);
  if (ctx.length) {
    heading("Clinical context");
    bullets(ctx);
  }

  // Image
  const image = imageUrl ? await loadImage(imageUrl) : null;
  if (image) {
    const maxW = width * 0.6;
    const maxH = 90;
    const ratio = Math.min(maxW / image.width, maxH / image.height);
    const w = image.width * ratio;
    const h = image.height * ratio;
    heading("Image reviewed");
    ensure(h + 2);
    doc.addImage(image.data, "JPEG", margin, y, w, h);
    y += h + 3;
  }

  if (report.impression) {
    const d = report.details || {};
    const more = [
      d.image_quality ? `Image quality: ${d.image_quality}` : "",
      ...(d.also_considered || []).map((o) => `Also considered: ${o}`),
      ...(d.limitations || []).map((o) => `Limitation: ${o}`),
    ].filter(Boolean);
    if (more.length) {
      heading("More detail");
      bullets(more);
    }
  } else {
    heading("Region and view");
    write(report.region_and_view);
    write(
      `Image quality: ${report.image_quality.adequate ? "adequate" : "limited"}. ${report.image_quality.notes}`,
      { color: MUTED }
    );

    heading("Observations");
    bullets(report.observations);

    heading("Possible findings");
    if (!report.findings.length) {
      write("No findings reported.", { color: MUTED });
    } else {
      for (const f of report.findings) {
        write(`[${LABELS[f.confidence] || f.confidence}] ${f.finding} - ${f.location}`, { style: "bold", gap: 0.5 });
        write(f.reasoning, { color: MUTED, indent: 4, gap: 2 });
      }
    }

    heading("Suggested follow-up");
    bullets(report.suggested_followup);

    heading("Limitations");
    bullets(report.limitations);

  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Page ${p} of ${pages}`, pageW - margin, pageH - 9, { align: "right" });
  }

  const slug = (meta.label || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "report";
  const pad = (n) => String(n).padStart(2, "0");
  const localDate = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
  doc.save(`neatx-ray-${slug}-${localDate}.pdf`);
}
