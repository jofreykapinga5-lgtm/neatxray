import { z } from "zod";

// Report shape: the answer first, everything else out of the way.
// Older saved reports use a longer shape (observations, findings, ...); the viewers still read those.
export const ReportSchema = z.object({
  image_type: z
    .enum(["xray", "other_medical", "not_medical"])
    .describe(
      "'xray' for plain radiographs. 'other_medical' for any other medical image (CT, MRI, ultrasound, ECG, endoscopy, clinical photo). 'not_medical' only if none of the images is a medical image."
    ),
  image_type_note: z
    .string()
    .describe("One short sentence saying what the image is. For 'xray' use an empty string."),
  region_and_view: z
    .string()
    .describe("Body region and view in a few words, e.g. 'Elbow, lateral'. Include the side or digit only if it is established; never guess it. Use 'Unclear' if it cannot be determined."),
  impression: z
    .string()
    .describe(
      "The single most useful conclusion as one direct sentence of at most 25 words: the most likely diagnosis, or 'No acute abnormality seen.' Plain wording, no hedging words; show uncertainty only through the confidence field."
    ),
  confidence: z
    .enum(["likely", "possible", "unlikely"])
    .describe("How confident you are in the impression exactly as written."),
  urgency: z
    .enum(["routine", "soon", "urgent"])
    .describe("'urgent' if something may need action now (for example displaced fracture, pneumothorax, free air). 'soon' if it needs attention within days. Otherwise 'routine'."),
  urgency_reason: z
    .string()
    .describe("One short sentence saying why. Empty string when urgency is 'routine'."),
  key_findings: z
    .array(z.string())
    .describe("The 2 to 4 visible findings that support the impression, each under 15 words. Describe only what is seen. Do not list normal structures unless they matter."),
  next_steps: z
    .array(z.string())
    .describe("1 to 3 concrete next steps, most important first, each under 15 words."),
  details: z
    .object({
      image_quality: z
        .string()
        .describe("One short sentence, only if image quality limits the read. Empty string if the image is fine."),
      also_considered: z
        .array(z.string())
        .describe("Up to 3 alternative diagnoses or pertinent negatives, each under 15 words. Empty array if none matter."),
      limitations: z
        .array(z.string())
        .describe("Up to 2 short limitations. Empty array if none matter."),
    })
    .describe("Secondary information. Keep it minimal; it is hidden behind a 'More detail' control."),
});
