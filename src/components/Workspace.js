"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { prepareFiles } from "@/lib/prepare-files";
import Logo from "./Logo";
import Viewer from "./Viewer";
import ReportView from "./ReportView";
import CameraCapture from "./CameraCapture";
import AnalysisModal from "./AnalysisModal";

const EMPTY_PATIENT = { age: "", sex: "", symptoms: "", history: "", question: "" };

export default function Workspace({ email }) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const fileInput = useRef(null);

  const [images, setImages] = useState([]); // { blob, name, url }
  const [index, setIndex] = useState(0);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [patient, setPatient] = useState(EMPTY_PATIENT);
  const setP = (key, value) => setPatient((p) => ({ ...p, [key]: value }));
  const [status, setStatus] = useState("idle"); // idle | preparing | uploading | analyzing
  const [error, setError] = useState("");
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
    caseIdRef.current = null;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function requestAnalysis(caseId) {
    setStatus("analyzing");
    setStage("analyzing");
    setProgress((p) => Math.max(p, 30));
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 422 && body.code === "not_medical") {
      caseIdRef.current = null;
      setRejection(body.detail || "");
      setPhase("rejected");
      loadHistory();
      return;
    }
    if (!res.ok) throw new Error(body.error || "Analysis failed.");
    setProgress(100);
    setResult({ ...body, createdAt: new Date().toISOString() });
    loadHistory();
    await sleep(400);
    setPhase("done");
  }

  async function runAnalysis() {
    if (!images.length) return;
    setError("");
    setResult(null);
    caseIdRef.current = null;
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
          clinical_notes: notes.trim(),
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
    setPhase("working");
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
          provider: result.provider,
          model: result.model,
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
    const { data: rows } = await supabase.from("case_images").select("storage_path, original_name").eq("case_id", c.id).order("created_at");
    const loaded = [];
    for (const row of rows || []) {
      const { data } = await supabase.storage.from("scans").createSignedUrl(row.storage_path, 60 * 10);
      if (data?.signedUrl) loaded.push({ name: row.original_name, url: data.signedUrl, blob: null });
    }
    setImages(loaded);
    setIndex(0);
    setLabel(c.label || "");
    setNotes(c.clinical_notes || "");
    setPatient({
      age: c.patient_age ?? "",
      sex: c.patient_sex || "",
      symptoms: c.symptoms || "",
      history: c.medical_history || "",
      question: c.clinical_question || "",
    });
    setResult(c.report ? { report: c.report, provider: c.provider, model: c.model, createdAt: c.created_at } : null);
    if (c.report) {
      setPhase("done");
      setModalOpen(true);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteCase(c) {
    if (!window.confirm("Delete this case and its images permanently?")) return;
    const { data: rows } = await supabase.from("case_images").select("storage_path").eq("case_id", c.id);
    const paths = (rows || []).map((r) => r.storage_path);
    if (paths.length) await supabase.storage.from("scans").remove(paths);
    await supabase.from("cases").delete().eq("id", c.id);
    loadHistory();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const statusText = { preparing: "Preparing files…", uploading: "Uploading securely…", analyzing: "Analyzing… this can take up to a minute." }[status];
  const canAnalyze = images.length > 0 && images.every((i) => i.blob) && !busy;

  return (
    <div className="min-h-screen">

      <header className="mx-auto max-w-7xl px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
        <h1><Logo size={34} /></h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-muted">{email}</span>
          <button type="button" onClick={signOut} className="btn-ghost">Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pb-16 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Viewer images={images} index={index} onSelect={setIndex} />

          <div className="card p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={busy} onClick={() => fileInput.current?.click()}>
                Upload image or PDF
              </button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setShowCamera(true)}>
                Use camera
              </button>
              {images.length > 0 && (
                <button type="button" className="btn-ghost" disabled={busy} onClick={reset}>
                  New scan
                </button>
              )}
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
            </div>

            {messages.map((m, i) => (
              <p key={i} className="text-sm text-amber-800">{m}</p>
            ))}

            {images.some((i) => i.blob) && (
              <ul className="flex flex-wrap gap-2 text-xs">
                {images.map((img, i) =>
                  img.blob ? (
                    <li key={img.url} className="rounded-full border border-line px-3 py-1 flex items-center gap-2">
                      {img.name}
                      <button type="button" aria-label={`Remove ${img.name}`} onClick={() => removeImage(i)} className="text-muted hover:text-navy">
                        ×
                      </button>
                    </li>
                  ) : null
                )}
              </ul>
            )}

            <fieldset className="space-y-3 rounded-xl border border-line p-3">
              <legend className="px-1 text-sm font-semibold">Patient details</legend>
              <p className="text-xs text-muted">
                Do not enter names, phone numbers or addresses.
              </p>
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
                <span>Relevant history</span>
                <textarea className="field mt-1" rows={2} value={patient.history} onChange={(e) => setP("history", e.target.value)} maxLength={500} placeholder="e.g. smoker, TB contact, prior surgery, known conditions" />
              </label>
              <label className="block text-sm">
                <span>Clinical question</span>
                <input className="field mt-1" value={patient.question} onChange={(e) => setP("question", e.target.value)} maxLength={300} placeholder="e.g. Any sign of pneumonia?" />
              </label>
            </fieldset>

            <label className="block text-sm">
              <span>Case label <span className="text-muted">(optional)</span></span>
              <input className="field mt-1" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="e.g. Chest PA, follow-up" />
            </label>
            <label className="block text-sm">
              <span>Additional notes <span className="text-muted">(optional)</span></span>
              <textarea className="field mt-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </label>

            <button type="button" className="btn-primary w-full" disabled={!canAnalyze} onClick={runAnalysis}>
              {busy ? statusText : "Analyze"}
            </button>
            {error && !modalOpen && <p role="alert" className="text-sm text-red-700">{error}</p>}
          </div>
        </div>

        <div className="space-y-6">
          <section className="card p-5 sm:p-6" aria-live="polite">
            <h2 className="font-serif text-2xl mb-4">Report</h2>
            {result ? (
              <ReportView report={result.report} provider={result.provider} model={result.model} onDownload={downloadPdf} />
            ) : (
              <p className="text-sm text-muted">
                {busy ? statusText : "Add an X-ray and press Analyze. The AI report will appear here."}
              </p>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="font-serif text-xl mb-3">Recent cases</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted">No saved cases yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {history.map((c) => (
                  <li key={c.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.label || "Untitled case"}</span>
                      <span className="block text-xs text-muted">
                        {new Date(c.created_at).toLocaleString()} · {c.report ? "analyzed" : "no report"}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openCase(c)}
                        aria-label={`Open ${c.label || "untitled case"}`}
                        className="btn-primary !min-h-0 !px-4 !py-1.5 text-sm"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCase(c)}
                        aria-label={`Delete ${c.label || "untitled case"}`}
                        className="btn-ghost !min-h-0 !px-3 !py-1.5 text-sm !text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      {modalOpen && (
        <AnalysisModal
          phase={phase}
          stage={stage}
          progress={progress}
          error={error}
          result={result}
          rejection={rejection}
          onChooseAnother={chooseAnother}
          onClose={closeModal}
          onRetry={retryAnalysis}
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
    </div>
  );
}
