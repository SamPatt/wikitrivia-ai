// usage: node run.ts <modelKey|all> [--limit N] [--conc N]
// Asks each model to date every unique card in games.json; caches answers in
// results/<key>.jsonl so reruns only fill gaps.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { MODELS } from "./models.ts";
import { call } from "./providers.ts";
import { SYSTEM, modernPrompt, legacyPrompt, parseYear } from "./prompt.ts";

const args = process.argv.slice(2);
const opt = (k: string, d: number) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
const limit = opt("--limit", Infinity);
const conc = opt("--conc", 4);
const which = args[0] ?? "all";

const games = JSON.parse(readFileSync(new URL("games.json", import.meta.url), "utf8"));
// round-robin across games so a --limit run still samples every game
const seen = new Set<string>();
const cards: any[] = [];
for (let k = 0; k < games[0].length; k++)
  for (const g of games) if (!seen.has(g[k].id)) { seen.add(g[k].id); cards.push(g[k]); }

const targets = which === "all" ? MODELS : MODELS.filter((m) => which.split(",").includes(m.key));
if (!targets.length) throw new Error(`unknown model ${which}`);

for (const m of targets) {
  const file = new URL(`results/${m.key}.jsonl`, import.meta.url);
  const done = new Set(existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);
  const todo = cards.slice(0, limit).filter((c) => !done.has(c.id));
  const legacy = m.prompt === "legacy2024";
  let i = 0, errors = 0;
  const t0 = Date.now();
  const worker = async () => {
    while (i < todo.length) {
      const c = todo[i++];
      try {
        const r = await call(m, legacy ? "" : SYSTEM, legacy ? legacyPrompt(c) : modernPrompt(c));
        const guess = parseYear(r.text, legacy);
        appendFileSync(file, JSON.stringify({ id: c.id, year: c.year, guess, ...r, text: r.text.slice(0, 2000) }) + "\n");
      } catch (e: any) {
        errors++;
        console.error(`  [${m.key}] ${c.label}: ${e.message.slice(0, 200)}`);
        if (errors > 8 && errors > todo.length / 4) { console.error(`  [${m.key}] too many errors, skipping`); i = todo.length; }
      }
    }
  };
  await Promise.all(Array.from({ length: m.kind.endsWith("cli") || m.kind === "ollama" ? 1 : conc }, worker));
  console.log(`${m.key}: ${todo.length - errors}/${todo.length} new answers in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
