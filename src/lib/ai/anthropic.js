import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ReportSchema } from "./schema";
import { SYSTEM_PROMPT, buildUserText } from "./prompt";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export async function analyzeWithAnthropic({ images, notes, label, patient }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const content = [
    ...images.map((img) => ({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 },
    })),
    { type: "text", text: buildUserText({ notes, label, patient }) },
  ];

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: { effort: "high", format: zodOutputFormat(ReportSchema) },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to analyze this image.");
  }
  if (!response.parsed_output) {
    throw new Error("The model returned a report that could not be read.");
  }
  return { report: response.parsed_output, model: MODEL };
}
