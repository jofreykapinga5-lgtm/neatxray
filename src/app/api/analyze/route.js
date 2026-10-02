import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyze } from "@/lib/ai";
import { splitNotes } from "@/lib/case-notes";
import { CREDITS_ENABLED, OUT_OF_CREDITS, SCAN_COST, charge, getBalance } from "@/lib/credits";

export const maxDuration = 300;

const DAILY_LIMIT = Number(process.env.DAILY_SCAN_LIMIT || 50);

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { caseId, provider } = await request.json().catch(() => ({}));
  if (!caseId) return NextResponse.json({ error: "caseId is required" }, { status: 400 });

  // RLS guarantees these only return the signed-in doctor's own rows.
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, label, clinical_notes, patient_age, patient_sex, symptoms, medical_history, clinical_question")
    .eq("id", caseId)
    .single();
  if (caseError || !caseRow) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true })
    .not("report", "is", null)
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: "Daily scan limit reached." }, { status: 429 });
  }

  if (CREDITS_ENABLED) {
    try {
      if ((await getBalance(supabase)) < SCAN_COST) {
        return NextResponse.json({ code: "no_credits", error: OUT_OF_CREDITS }, { status: 402 });
      }
    } catch (err) {
      console.error("analyze: could not read credits:", err?.message || err);
      return NextResponse.json({ error: "Could not check your credits. Please try again." }, { status: 503 });
    }
  }

  const { data: imageRows, error: imagesError } = await supabase
    .from("case_images")
    .select("storage_path, mime_type")
    .eq("case_id", caseId)
    .order("created_at");
  if (imagesError || !imageRows?.length) {
    return NextResponse.json({ error: "No images attached to this case" }, { status: 400 });
  }

  const images = [];
  for (const row of imageRows) {
    const { data: blob, error } = await supabase.storage.from("scans").download(row.storage_path);
    if (error || !blob) return NextResponse.json({ error: "Could not load an image" }, { status: 500 });
    const buffer = Buffer.from(await blob.arrayBuffer());
    images.push({ mediaType: row.mime_type || "image/jpeg", base64: buffer.toString("base64") });
  }

  try {
    const result = await analyze(
      {
        images,
        notes: splitNotes(caseRow.clinical_notes).notes,
        label: caseRow.label,
        patient: {
          area: splitNotes(caseRow.clinical_notes).area,
          age: caseRow.patient_age,
          sex: caseRow.patient_sex,
          symptoms: caseRow.symptoms,
          history: caseRow.medical_history,
          question: caseRow.clinical_question,
        },
      },
      provider || undefined
    );
    // Not a medical image: remove the case and its files so nothing is kept or counted.
    if (result.report.image_type === "not_medical") {
      const paths = imageRows.map((r) => r.storage_path);
      await supabase.storage.from("scans").remove(paths);
      await supabase.from("cases").delete().eq("id", caseId);
      return NextResponse.json(
        {
          code: "not_medical",
          error: "This does not look like a medical image.",
          detail: result.report.image_type_note || "",
        },
        { status: 422 }
      );
    }

    await supabase
      .from("cases")
      .update({ report: result.report, provider: result.provider, model: result.model })
      .eq("id", caseId);

    // Charged only once a real report exists, and only once per case (the ref makes a repeat free).
    let credits;
    if (CREDITS_ENABLED) {
      try {
        const paid = await charge(supabase, SCAN_COST, "scan", `analyze:${caseId}`);
        credits = paid.ok ? paid.balance : 0;
      } catch (err) {
        console.error("analyze: could not charge credits:", err?.message || err);
      }
    }
    return NextResponse.json({ report: result.report, provider: result.provider, model: result.model, credits });
  } catch (err) {
    console.error("analyze failed:", err);
    return NextResponse.json({ error: err.message || "Analysis failed" }, { status: 502 });
  }
}
