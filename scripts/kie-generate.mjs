// Usage: node --env-file=.env.local scripts/kie-generate.mjs <outDir> <prefix> <model> <inputJson> [count]
// Creates Kie AI tasks, polls until done, downloads the results.
import fs from "node:fs";
import path from "node:path";

const [outDir, prefix, model, inputJson, countArg] = process.argv.slice(2);
const count = Number(countArg || 1);
const key = process.env.KIE_API_KEY;
if (!key) throw new Error("KIE_API_KEY missing");
const BASE = "https://api.kie.ai/api/v1";
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
fs.mkdirSync(outDir, { recursive: true });

async function createTask(input) {
  const res = await fetch(`${BASE}/jobs/createTask`, { method: "POST", headers, body: JSON.stringify({ model, input }) });
  const body = await res.json();
  if (body.code !== 200 || !body.data?.taskId) throw new Error("createTask failed: " + JSON.stringify(body));
  return body.data.taskId;
}

async function waitFor(taskId) {
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(`${BASE}/jobs/recordInfo?taskId=${taskId}`, { headers });
    const { data } = await res.json();
    if (data?.state === "success") {
      const parsed = typeof data.resultJson === "string" ? JSON.parse(data.resultJson) : data.resultJson;
      return parsed.resultUrls || [];
    }
    if (data?.state === "fail") throw new Error(`task ${taskId} failed: ${data.failMsg}`);
  }
  throw new Error(`task ${taskId} timed out`);
}

const base = JSON.parse(inputJson);
const jobs = Array.from({ length: count }, async (_, n) => {
  const taskId = await createTask({ ...base, seed: base.seed ?? 1000 + n * 7919 });
  const urls = await waitFor(taskId);
  for (let k = 0; k < urls.length; k++) {
    const ext = path.extname(new URL(urls[k]).pathname) || ".png";
    const file = path.join(outDir, `${prefix}-${n + 1}${urls.length > 1 ? "-" + (k + 1) : ""}${ext}`);
    fs.writeFileSync(file, Buffer.from(await (await fetch(urls[k])).arrayBuffer()));
    console.log("saved", file);
  }
});
await Promise.all(jobs);
