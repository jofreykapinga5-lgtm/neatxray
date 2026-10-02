import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ReportSchema } from "./schema";
import { SYSTEM_PROMPT, buildUserText } from "./prompt";
import { COMPARE_MODELS, MEDGEMMA_MODEL, costOf } from "./models";

// Runs the same film and the same instructions through one Claude model.
async function runModel(client, model, { images, notes, label, patient }) {
  const content = [
    ...images.map((img) => ({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 },
    })),
    { type: "text", text: buildUserText({ notes, label, patient }) },
  ];

  const output_config = { format: zodOutputFormat(ReportSchema) };
  if (model.effort) output_config.effort = "high"; // same setting the app uses today

  const started = Date.now();
  const response = await client.messages.parse({
    model: model.id,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config,
    messages: [{ role: "user", content }],
  });
  const seconds = Math.round((Date.now() - started) / 100) / 10;

  if (response.stop_reason === "refusal") throw new Error("This model declined to analyze the image.");
  if (!response.parsed_output) throw new Error("The model's answer could not be read.");

  return {
    report: response.parsed_output,
    seconds,
    tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    cost: costOf(model, response.usage),
  };
}

// MedGemma on our GPU pod. Cost is the pod's hourly price for the seconds this scan used.
async function runMedGemma({ images, notes, label, patient }) {
  const res = await fetch(`${process.env.GPU_URL}/medgemma`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GPU_API_TOKEN}` },
    body: JSON.stringify({
      images: images.map((i) => i.base64),
      system: SYSTEM_PROMPT,
      context: buildUserText({ notes, label, patient }),
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) throw new Error(`The GPU service answered ${res.status}.`);
  const body = await res.json();
  if (!body.report) throw new Error("The model's answer could not be read.");
  return {
    report: body.report,
    seconds: body.seconds,
    tokens: body.tokens,
    cost: (body.seconds * MEDGEMMA_MODEL.perHour) / 3600,
  };
}

// All models in parallel. One failing never hides the others.
export async function compareModels(input) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 240_000, maxRetries: 1 });
  const withPod = Boolean(process.env.GPU_URL && process.env.GPU_API_TOKEN);
  const models = withPod ? [...COMPARE_MODELS, MEDGEMMA_MODEL] : COMPARE_MODELS;
  const settled = await Promise.allSettled(
    models.map((m) => (m === MEDGEMMA_MODEL ? runMedGemma(input) : runModel(client, m, input)))
  );
  return models.map((m, i) => {
    const base = { id: m.id, name: m.name, note: m.note, inputPerMTok: m.inputPerMTok, outputPerMTok: m.outputPerMTok, perHour: m.perHour };
    const s = settled[i];
    if (s.status === "fulfilled") return { ...base, ok: true, ...s.value };
    console.error(`compare: ${m.id} failed:`, s.reason?.message || s.reason);
    return { ...base, ok: false, error: s.reason?.message || "This model failed." };
  });
}

// Chest finding scores from TorchXRayVision on our GPU pod. Only meaningful for chest films,
// so it runs only when most of the models that answered describe the film as a chest image.
export async function chestScores(images, models) {
  if (!process.env.GPU_URL || !process.env.GPU_API_TOKEN) return null;
  const answered = models.filter((m) => m.ok);
  const chest = answered.filter((m) => /chest|lung|thora|cxr/i.test(m.report.region_and_view || ""));
  if (answered.length === 0 || chest.length * 2 < answered.length) return null;
  try {
    const res = await fetch(`${process.env.GPU_URL}/xrv`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GPU_API_TOKEN}` },
      body: JSON.stringify({ image: images[0].base64 }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return { findings: body.findings.slice(0, 6), seconds: body.seconds };
  } catch (err) {
    console.error("compare: xrv failed:", err?.message || err);
    return null;
  }
}
