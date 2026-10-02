// Claude models shown side by side in "Compare Claude models", cheapest first.
// Prices are US dollars per million tokens, from Anthropic's pricing page (checked 1 Oct 2026).
export const COMPARE_MODELS = [
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", note: "Smallest and cheapest", inputPerMTok: 1, outputPerMTok: 5, effort: false },
  { id: "claude-sonnet-5", name: "Claude Sonnet 5", note: "Mid-range", inputPerMTok: 2, outputPerMTok: 10, effort: true },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", note: "Used by neatx-ray today", inputPerMTok: 2, outputPerMTok: 10, effort: true },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", note: "Strongest Opus tier", inputPerMTok: 4, outputPerMTok: 20, effort: true },
  { id: "claude-fable-5-1", name: "Claude Fable 5.1", note: "Most capable", inputPerMTok: 10, outputPerMTok: 50, effort: true },
];

// What one request really cost, from the token counts Anthropic reports back.
export function costOf(model, usage) {
  const input = usage?.input_tokens ?? 0;
  const output = usage?.output_tokens ?? 0; // includes the model's thinking tokens
  return (input * model.inputPerMTok + output * model.outputPerMTok) / 1_000_000;
}

// Runs on our own GPU pod (see gpu-server/). Priced by the hour, not per token.
export const MEDGEMMA_MODEL = {
  id: "medgemma-1.5-4b-it",
  name: "MedGemma 1.5 4B",
  note: "Medical model on our own GPU",
  perHour: 0.49,
};

export const LINGSHU_MODEL = {
  id: "lingshu-7b",
  name: "Lingshu 7B",
  note: "Medical model on our own GPU",
  perHour: 0.49,
};
