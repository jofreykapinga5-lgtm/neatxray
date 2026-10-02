import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chestScores, compareModels } from "@/lib/ai/compare";
import { splitNotes } from "@/lib/case-notes";
import { COMPARE_COST, CREDITS_ENABLED, OUT_OF_CREDITS, charge, getBalance } from "@/lib/credits";

export const maxDuration = 300;

// One comparison runs five models, so keep it from being hammered: a short pause per person
// (best effort, per server instance) and an optional list of who may use it.
const lastRun = new Map();
const COOLDOWN_MS = 20_000;

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const allowed = (process.env.COMPARE_ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes((user.email || "").toLowerCase())) {
    return NextResponse.json({ error: "Model comparison is not enabled for this account." }, { status: 403 });
  }

  const last = lastRun.get(user.id) || 0;
  if (Date.now() - last < COOLDOWN_MS) {
    return NextResponse.json({ error: "Please wait a few seconds before comparing again." }, { status: 429 });
  }

  if (CREDITS_ENABLED) {
    try {
      if ((await getBalance(supabase)) < COMPARE_COST) {
        return NextResponse.json({ code: "no_credits", error: `Comparing models uses ${COMPARE_COST} credits. ${OUT_OF_CREDITS}` }, { status: 402 });
      }
    } catch (err) {
      console.error("compare: could not read credits:", err?.message || err);
      return NextResponse.json({ error: "Could not check your credits. Please try again." }, { status: 503 });
    }
  }

  const { caseId } = await request.json().catch(() => ({}));
  if (!caseId) return NextResponse.json({ error: "caseId is required" }, { status: 400 });

  // RLS guarantees these only return the signed-in doctor's own rows.
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, label, clinical_notes, patient_age, patient_sex, symptoms, medical_history, clinical_question")
    .eq("id", caseId)
    .single();
  if (caseError || !caseRow) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const { data: imageRows } = await supabase
    .from("case_images")
    .select("storage_path, mime_type")
    .eq("case_id", caseId)
    .order("created_at");
  if (!imageRows?.length) return NextResponse.json({ error: "No images attached to this case" }, { status: 400 });

  const images = [];
  for (const row of imageRows) {
    const { data: blob, error } = await supabase.storage.from("scans").download(row.storage_path);
    if (error || !blob) return NextResponse.json({ error: "Could not load an image" }, { status: 500 });
    images.push({ mediaType: row.mime_type || "image/jpeg", base64: Buffer.from(await blob.arrayBuffer()).toString("base64") });
  }

  lastRun.set(user.id, Date.now());
  const saved = splitNotes(caseRow.clinical_notes);
  const models = await compareModels({
    images,
    notes: saved.notes,
    label: caseRow.label,
    patient: {
      area: saved.area,
      age: caseRow.patient_age,
      sex: caseRow.patient_sex,
      symptoms: caseRow.symptoms,
      history: caseRow.medical_history,
      question: caseRow.clinical_question,
    },
  });
  const xrv = await chestScores(images, models);
  let credits;
  if (CREDITS_ENABLED) {
    try {
      const paid = await charge(supabase, COMPARE_COST, "compare", `compare:${caseId}:${crypto.randomUUID()}`);
      credits = paid.ok ? paid.balance : 0;
    } catch (err) {
      console.error("compare: could not charge credits:", err?.message || err);
    }
  }
  return NextResponse.json({ models, xrv, credits });
}
