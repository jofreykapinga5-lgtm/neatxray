import { analyzeWithAnthropic } from "./anthropic";
import { analyzeWithOpenAI } from "./openai";

const PROVIDERS = {
  anthropic: analyzeWithAnthropic,
  openai: analyzeWithOpenAI,
};

export async function analyze(input, provider = process.env.AI_PROVIDER || "anthropic") {
  const run = PROVIDERS[provider];
  if (!run) throw new Error(`Unknown AI provider: ${provider}`);
  const result = await run(input);
  return { ...result, provider };
}
