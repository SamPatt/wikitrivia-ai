// Stage-1 sweep: every (open model, provider) endpoint answers the same 16 cards.
// usage: node probe.ts <endpoints.tsv> [--conc 24]
// tsv columns: model_id  provider  tag  $in/M  $out/M
import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { call } from "./providers.ts";
import { SYSTEM, modernPrompt, parseYear } from "./prompt.ts";
import type { ModelSpec } from "./models.ts";

const [file] = process.argv.slice(2);
const conc = process.argv.includes("--conc") ? Number(process.argv[process.argv.indexOf("--conc") + 1]) : 24;
const games = JSON.parse(readFileSync(new URL("games.json", import.meta.url), "utf8"));
// cards 2..3 of every game (12 games x 2 = 24) minus 8 -> 16 mid-difficulty cards
const cards = games.flatMap((g: any[]) => [g[2], g[3]]).slice(0, 16);

const out = new URL("probe/", import.meta.url);
mkdirSync(out, { recursive: true });
const eps = readFileSync(file, "utf8").trim().split("\n").map((l) => l.split("\t"));

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function probe([model, provider, tag]: string[]) {
  const key = `${model.replace("/", "_")}@${(tag || provider).replace(/[/ ]/g, "_")}`;
  const f = new URL(`${key}.jsonl`, out);
  if (existsSync(f)) return;
  const base: ModelSpec = { key, label: `${model} @ ${provider}`, kind: "openrouter", model, provider: tag || provider };
  // Try low reasoning first; fall back to no reasoning parameter if the endpoint rejects it.
  let spec: ModelSpec = { ...base, extra: { reasoning: { effort: "low" } } };
  let fails = 0;
  for (const c of cards) {
    try {
      const r = await withTimeout(call(spec, SYSTEM, modernPrompt(c)), 30_000);
      appendFileSync(f, JSON.stringify({ id: c.id, year: c.year, guess: parseYear(r.text), ms: r.ms, cost: r.cost, outTok: r.outTok, served: r.served, text: r.text.slice(0, 300) }) + "\n");
    } catch (e: any) {
      if (spec.extra && /reasoning|400/.test(e.message)) { spec = base; }
      appendFileSync(f, JSON.stringify({ id: c.id, year: c.year, error: e.message.slice(0, 160) }) + "\n");
      if (++fails >= 4) return;
    }
  }
}

let i = 0;
await Promise.all(Array.from({ length: conc }, async () => { while (i < eps.length) await probe(eps[i++]); }));
console.log("probed", eps.length);
