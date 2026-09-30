import { z } from "zod";

export const ReportSchema = z.object({
  region_and_view: z.string().describe("Body region and projection, e.g. 'Chest PA' or 'Left wrist, lateral'. Say 'Unclear' if not determinable."),
  image_quality: z.object({
    adequate: z.boolean(),
    notes: z.string().describe("Positioning, exposure, artifacts, glare or photo-of-screen issues."),
  }),
  observations: z.array(z.string()).describe("Neutral descriptive observations, in order of relevance."),
  findings: z.array(
    z.object({
      finding: z.string(),
      location: z.string(),
      confidence: z.enum(["likely", "possible", "unlikely"]),
      reasoning: z.string().describe("Visible features supporting this, in one or two sentences."),
    })
  ),
  urgent_attention: z.boolean().describe("True only if something appears potentially time-critical."),
  urgent_reason: z.string().describe("Empty string unless urgent_attention is true."),
  suggested_followup: z.array(z.string()),
  limitations: z.array(z.string()).describe("What the AI cannot determine from these images."),
});
