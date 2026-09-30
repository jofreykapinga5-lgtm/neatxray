import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ReportSchema } from "./schema";
import { SYSTEM_PROMPT, buildUserText } from "./prompt";

export async function analyzeWithOpenAI({ images, notes, label, patient }) {
  const model = process.env.OPENAI_MODEL;
  if (!model) throw new Error("OPENAI_MODEL is not set in the environment.");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const content = [
    { type: "text", text: buildUserText({ notes, label, patient }) },
    ...images.map((img) => ({
      type: "image_url",
      image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
    })),
  ];

  const completion = await client.chat.completions.parse({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
    response_format: zodResponseFormat(ReportSchema, "xray_report"),
  });

  const message = completion.choices[0]?.message;
  if (message?.refusal) throw new Error("The model declined to analyze this image.");
  if (!message?.parsed) throw new Error("The model returned a report that could not be read.");
  return { report: message.parsed, model };
}
