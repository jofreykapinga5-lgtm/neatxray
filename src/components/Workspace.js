"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { prepareFiles } from "@/lib/prepare-files";
import AppShell from "./AppShell";
import BuyCreditsModal from "./BuyCreditsModal";
import Viewer from "./Viewer";
import CameraCapture from "./CameraCapture";
import AnalysisModal from "./AnalysisModal";
import { composeNotes, splitNotes } from "@/lib/case-notes";

const ANALYSIS_TIMEOUT_MS = 120000;
const TIMEOUT_MESSAGE = "This is taking longer than expected. If the report finishes, it will appear in Recent cases.";

const EMPTY_PATIENT = { area: "", age: "", sex: "", symptoms: "", history: "", question: "" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const dateFormatWithYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

function caseWhen(iso) {
  const date = new Date(iso);
  return (date.getFullYear() === new Date().getFullYear() ? dateFormat : dateFormatWithYear).format(date);
}

function caseTitle(c) {
  if (c.label) return c.label;
  const age = c.patient_age !== null && c.patient_age !== undefined ? `${c.patient_age} y` : "";
  const sex = c.patient_sex === "female" ? "F" : c.patient_sex === "male" ? "M" : "";
  const who = [age, sex].filter(Boolean).join(" ");
  // Drop bracketed asides such as "(likely PA, erect)" so titles stay short.
  const region = c.report?.region_and_view?.replace(/\s*\([^)]*\)/g, "");
  return [region, who].filter(Boolean).join(", ") || "Untitled case";
}

export default function Workspace({ email, initialCredits = null }) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const fileInput = useRef(null);
  const detailsRef = useRef(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [images, setImages] = useState([]); // { blob, name, url }
  const [index, setIndex] = useState(0);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [patient, setPatient] = useState(EMPTY_PATIENT);
  const setP = (key, value) => setPatient((p) => ({ ...p, [key]: value }));
  const [status, setStatus] = useState("idle"); // idle | preparing | uploading | analyzing
  const [error, setError] = useState("");
  const [credits, setCredits] = useState(initialCredits);
  const [buyOpen, setBuyOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [result, setResult] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [history, setHistory] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [phase, setPhase] = useState("working"); // working | done | error
  const [stage, setStage] = useState("uploading"); // uploading | analyzing
  const [progress, setProgress] = useState(0);
  const caseIdRef = useRef(null);
  const [rejection, setRejection] = useState("");
  const abortRef = useRef(null);
  const stoppedRef = useRef(false);
  const [notice, setNotice] = useState("");
  const [resumeCaseId, setResumeCaseId] = useState(null);

  const busy = status !== "idle";

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("cases")
      .select("id, label, created_at, report, provider, model, patient_age, patient_sex, symptoms, medical_history, clinical_question, clinical_notes")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
  }, [supabase]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // The AI gives no real progress signal, so while it reads we ease toward 95% and jump to 100% on completion.
  useEffect(() => {
    if (phase !== "working" || stage !== "analyzing") return;
    const timer = setInterval(() => setProgress((p) => (p < 95 ? p + (95 - p) * 0.05 : p)), 600);
    return () => clearInterval(timer);
  }, [phase, stage]);

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setStatus("preparing");
    setError("");
    const { images: prepared, notes: problems } = await prepareFiles(files);
    setMessages(problems);
    setImages((prev) => [...prev, ...prepared.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) }))]);
    setStatus("idle");
  }

  function removeImage(i) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, n) => n !== i);
    });
    setIndex(0);
  }

  function reset() {
    images.forEach((i) => URL.revokeObjectURL(i.url));
    setImages([]);
    setIndex(0);
    setLabel("");
    setNotes("");
    setPatient(EMPTY_PATIENT);
    setResult(null);
    setError("");
    setMessages([]);
    setModalOpen(false);
    setNotice("");
    setResumeCaseId(null);
    caseIdRef.current = null;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function requestAnalysis(caseId) {
    setStatus("analyzing");
    setStage("analyzing");
    setProgress((p) => Math.max(p, 30));
    stoppedRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ANALYSIS_TIMEOUT_MS);
    let res;
    let body;
    try {
      res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
        signal: controller.signal,
      });
      body = await res.json().catch(() => ({}));
    } catch (err) {
      if (stoppedRef.current) return;
      if (timedOut) throw new Error(TIMEOUT_MESSAGE);
      throw err;
    } finally {
      clearTimeout(timer);
    }
    if (stoppedRef.current) return;
    if (timedOut) throw new Error(TIMEOUT_MESSAGE);
    if (res.status === 422 && body.code === "not_medical") {
      caseIdRef.current = null;
      setRejection(body.detail || "");
      setPhase("rejected");
      loadHistory();
      return;
    }
    if (!res.ok) throw new Error(body.error || "Analysis failed.");
    if (typeof body.credits === "number") setCredits(body.credits);
    setProgress(100);
    setResult({ ...body, createdAt: new Date().toISOString() });
    setResumeCaseId(null);
    loadHistory();
    await sleep(400);
    setPhase("done");
  }

  async function runAnalysis() {
    if (!images.length) return;
    setError("");
    setResult(null);
    caseIdRef.current = null;
    setNotice("");
    setResumeCaseId(null);
    setModalOpen(true);
    setPhase("working");
    setStage("uploading");
    setProgress(3);
    setStatus("uploading");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Please sign in again.");

      const { data: created, error: caseError } = await supabase
        .from("cases")
        .insert({
          user_id: user.id,
          label: label.trim(),
          clinical_notes: composeNotes(patient.area, notes),
          patient_age: patient.age === "" ? null : Number(patient.age),
          patient_sex: patient.sex,
          symptoms: patient.symptoms.trim(),
          medical_history: patient.history.trim(),
          clinical_question: patient.question.trim(),
        })
        .select("id")
        .single();
      if (caseError) throw new Error("Could not create the case.");
      caseIdRef.current = created.id;
      setProgress(6);

      for (let i = 0; i < images.length; i++) {
        const path = `${user.id}/${created.id}/${i + 1}.jpg`;
        const { error: upError } = await supabase.storage
          .from("scans")
          .upload(path, images[i].blob, { contentType: "image/jpeg" });
        if (upError) throw new Error("Image upload failed.");
        const { error: rowError } = await supabase.from("case_images").insert({
          case_id: created.id,
          user_id: user.id,
          storage_path: path,
          original_name: images[i].name,
          mime_type: "image/jpeg",
        });
        if (rowError) throw new Error("Could not save image details.");
        setProgress(6 + ((i + 1) / images.length) * 24);
      }

      await requestAnalysis(created.id);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setPhase("error");
    } finally {
      setStatus("idle");
    }
  }

  // Retry only the AI step when the images were already uploaded.
  async function retryAnalysis() {
    if (!caseIdRef.current) return runAnalysis();
    setError("");
    setNotice("");
    setModalOpen(true);
    setPhase("working");
    setStage("analyzing");
    setProgress((p) => Math.max(p, 30));
    setStatus("analyzing");
    try {
      await requestAnalysis(caseIdRef.current);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setPhase("error");
    } finally {
      setStatus("idle");
    }
  }

  function closeModal() {
    setModalOpen(false);
    setError("");
  }

  // Let the doctor leave the wait screen. The server keeps working; a finished report lands in Recent cases.
  function stopWaiting() {
    stoppedRef.current = true;
    abortRef.current?.abort();
    setModalOpen(false);
    setStatus("idle");
    setNotice("Still working in the background. If the report finishes, it will appear in Recent cases.");
    setTimeout(loadHistory, 40000);
    setTimeout(loadHistory, 90000);
  }

  // After a "not a medical image" rejection: drop the images, keep the patient details, pick again.
  function chooseAnother() {
    images.forEach((i) => i.blob && URL.revokeObjectURL(i.url));
    setImages([]);
    setIndex(0);
    setResult(null);
    closeModal();
    fileInput.current?.click();
  }

  async function downloadPdf() {
    if (!result) return;
    try {
      const { downloadReportPdf } = await import("@/lib/report-pdf");
      await downloadReportPdf({
        report: result.report,
        imageUrl: images[index]?.url || images[0]?.url,
        meta: {
          label,
          age: patient.age,
          sex: patient.sex,
          symptoms: patient.symptoms,
          history: patient.history,
          question: patient.question,
          notes,
          area: patient.area,
          createdAt: result.createdAt,
        },
      });
    } catch (err) {
      console.error(err);
      window.alert("Could not create the PDF. Please try again.");
    }
  }

  async function openCase(c) {
    setError("");
    setNotice("");
    const { data: rows } = await supabase.from("case_images").select("storage_path, original_name").eq("case_id", c.id).order("created_at");
    const loaded = [];
    for (const row of rows || []) {
      const { data } = await supabase.storage.from("scans").createSignedUrl(row.storage_path, 60 * 10);
      if (data?.signedUrl) loaded.push({ name: row.original_name, url: data.signedUrl, blob: null });
    }
    setImages(loaded);
    setIndex(0);
    setLabel(c.label || "");
    const saved = splitNotes(c.clinical_notes || "");
    setNotes(saved.notes);
    setPatient({
      area: saved.area,
      age: c.patient_age ?? "",
      sex: c.patient_sex || "",
      symptoms: c.symptoms || "",
      history: c.medical_history || "",
      question: c.clinical_question || "",
    });
    setResult(c.report ? { report: c.report, provider: c.provider, model: c.model, createdAt: c.created_at } : null);
    if (c.report) {
      setResumeCaseId(null);
      setPhase("done");
      setModalOpen(true);
    } else {
      // No report yet: the images are already saved, so Analyze can run just the AI step.
      caseIdRef.current = c.id;
      setResumeCaseId(c.id);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // The sidebar's Report item: bring the current report (or the running analysis) back on screen.
  function openReport() {
    if (result) {
      setPhase("done");
      setModalOpen(true);
    } else if (busy) {
      setModalOpen(true);
    }
  }

  async function deleteCase(c) {
    if (!window.confirm("Delete this case and its images permanently?")) return;
    const { data: rows } = await supabase.from("case_images").select("storage_path").eq("case_id", c.id);
    const paths = (rows || []).map((r) => r.storage_path);
    if (paths.length) await supabase.storage.from("scans").remove(paths);
    await supabase.from("cases").delete().eq("id", c.id);
    loadHistory();
  }

  const statusText = { preparing: "Preparing files…", uploading: "Uploading securely…", analyzing: "Analyzing… this usually takes about a minute." }[status];
  const resumable = Boolean(resumeCaseId) && !result;
  const canAnalyze = (images.length > 0 && images.every((i) => i.blob) && !busy) || (resumable && !busy);
  const hasImages = images.length > 0;
  const viewingSaved = images.some((i) => !i.blob);
  const detailsFilled = [
    patient.area.trim() !== "",
    patient.age !== "",
    patient.sex !== "",
    patient.symptoms.trim() !== "",
    patient.question.trim() !== "",
  ].filter(Boolean).length;

  function goToDetails() {
    const node = detailsRef.current;
    if (!node) return;
    setDetailsOpen(true);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    // Only pop the keyboard on devices that have a real pointer; on phones it would cover the form.
    if (window.matchMedia("(hover: hover)").matches) {
      setTimeout(() => node.querySelector("input, select, textarea")?.focus({ preventScroll: true }), 450);
    }
  }

  return (
    <AppShell
      email={email}
      credits={credits}
      report={{ state: result ? "ready" : busy ? "busy" : "none", onOpen: openReport }}
      recents={{
        items: history.map((c) => ({ id: c.id, title: caseTitle(c), when: caseWhen(c.created_at), hasReport: Boolean(c.report) })),
        onOpen: (id) => {
          const c = history.find((x) => x.id === id);
          if (c) openCase(c);
        },
        onDelete: (id) => {
          const c = history.find((x) => x.id === id);
          if (c) deleteCase(c);
        },
      }}
    >

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 pt-6 grid gap-6 lg:grid-cols-2">
        <h1 className="sr-only">Scan an X-ray</h1>
        <p className="sr-only" role="status">{result ? "Report ready" : busy ? statusText : ""}</p>
        <div className="min-w-0 space-y-4">
          <Viewer
            images={images}
            index={index}
            onSelect={setIndex}
            onUpload={() => fileInput.current?.click()}
            onCamera={() => setShowCamera(true)}
            onFiles={addFiles}
            onRemove={busy ? undefined : removeImage}
            busy={busy}
          />
        </div>

        <div className="min-w-0">
          <div className="card p-4 space-y-4">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/*,.heic,.heif,application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {messages.map((m, i) => (
              <p key={i} className="text-sm text-amber-800">{m}</p>
            ))}

            {hasImages && !viewingSaved && !busy && (
              <button
                type="button"
                onClick={goToDetails}
                className="motion-rise flex w-full items-center justify-between gap-3 rounded-2xl bg-accent/10 px-4 py-3 text-left text-navy"
              >
                <span className="text-sm">
                  <strong>Image added.</strong> Next, add a few patient details.
                  <span className="mt-0.5 block text-xs text-muted">They help the AI write a more useful report.</span>
                </span>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                  <path d="M12 5v14M6 13l6 6 6-6" />
                </svg>
              </button>
            )}

            <details
              ref={detailsRef}
              open={detailsOpen}
              onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
              className="group scroll-mt-4 rounded-xl bg-white shadow-[0_1px_5px_rgba(31,53,86,0.14)] px-3"
            >
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-navy">
                <span>
                  Patient details <span className="font-normal text-muted">({detailsFilled} of 5 added)</span>
                </span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <div className="space-y-3 pb-3 pt-1">
              <p className="text-sm text-navy/90">
                The AI reads the film together with what you tell it. More detail makes the report more specific and more useful.
              </p>
              <details className="text-sm text-navy/90">
                <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center font-medium text-navy underline underline-offset-4">
                  Why each detail helps
                </summary>
                <p className="pb-2">
                  Age and symptoms change which findings matter, and a clear clinical question tells it what you
                  need to decide. With none, the report stays general. Everything here is optional.
                </p>
              </details>
              <p className="text-xs text-muted">
                Do not enter names, phone numbers or addresses.
              </p>
              <label className="block text-sm">
                <span>Area imaged</span>
                <input className="field mt-1" value={patient.area} onChange={(e) => setP("area", e.target.value)} maxLength={120} placeholder="e.g. Left hand, little finger" />
                <span className="mt-1 block text-xs text-muted">Tells the AI exactly where to look, so it does not guess the side or the finger.</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span>Age</span>
                  <input className="field mt-1" type="number" inputMode="numeric" min="0" max="120" value={patient.age} onChange={(e) => setP("age", e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span>Sex</span>
                  <select className="field mt-1" value={patient.sex} onChange={(e) => setP("sex", e.target.value)}>
                    <option value="">Not stated</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <span>Main symptoms</span>
                <textarea className="field mt-1" rows={2} value={patient.symptoms} onChange={(e) => setP("symptoms", e.target.value)} maxLength={500} placeholder="e.g. cough for 3 days, fever, chest pain" />
              </label>
              <label className="block text-sm">
                <span>Clinical question</span>
                <input className="field mt-1" value={patient.question} onChange={(e) => setP("question", e.target.value)} maxLength={300} placeholder="e.g. Any sign of pneumonia?" />
              </label>
              </div>
            </details>

            <details className="group rounded-xl bg-white shadow-[0_1px_5px_rgba(31,53,86,0.14)] px-3">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-navy">
                <span>More options <span className="font-normal text-muted">(case label, notes)</span></span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <div className="space-y-4 pb-3 pt-1">
                <label className="block text-sm">
                  <span>Case label</span>
                  <input className="field mt-1" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="e.g. Chest PA, follow-up" />
                </label>
                <label className="block text-sm">
                  <span>Additional notes</span>
                  <textarea className="field mt-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
                </label>
              </div>
            </details>

            {resumable && (
              <p className="text-sm text-navy/80">
                This case has no report yet. Press Analyze to try again with the images already saved.
              </p>
            )}
            <button type="button" className="btn-primary w-full" disabled={!canAnalyze} onClick={resumable ? retryAnalysis : runAnalysis}>
              {busy ? statusText : "Analyze"}
            </button>
            {error && !modalOpen && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {notice && <p role="status" className="text-sm text-navy/80">{notice}</p>}

            {hasImages && (
              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                {!viewingSaved && (
                  <>
                    <button type="button" className="btn-ghost" disabled={busy} onClick={() => fileInput.current?.click()}>
                      Add another image
                    </button>
                    <button type="button" className="btn-ghost" disabled={busy} onClick={() => setShowCamera(true)}>
                      Use camera
                    </button>
                  </>
                )}
                <button type="button" className="btn-ghost" disabled={busy} onClick={reset}>
                  New scan
                </button>
              </div>
            )}
          </div>
        </div>

      </main>

      {modalOpen && (
        <AnalysisModal
          phase={phase}
          stage={stage}
          progress={progress}
          error={error}
          onBuy={credits !== null ? () => { closeModal(); setBuyOpen(true); } : undefined}
          result={result}
          rejection={rejection}
          thumb={images[0]?.url}
          onChooseAnother={chooseAnother}
          onClose={closeModal}
          onRetry={retryAnalysis}
          onStopWaiting={stopWaiting}
          onDownload={downloadPdf}
        />
      )}


      {showCamera && (
        <CameraCapture
          onClose={() => setShowCamera(false)}
          onCapture={(file) => {
            setShowCamera(false);
            addFiles([file]);
          }}
        />
      )}
      {buyOpen && <BuyCreditsModal balance={credits} onClose={() => setBuyOpen(false)} onCredits={setCredits} />}
    </AppShell>
  );
}
