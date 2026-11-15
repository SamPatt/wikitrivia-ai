// Scores cached answers against the fixed games exactly like the app:
// guess -> findPositionByYear -> compare with true position; 3 lives.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { MODELS } from "./models.ts";

const games: any[][] = JSON.parse(readFileSync(new URL("games.json", import.meta.url), "utf8"));
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const pos = (years: number[], y: number) => years.filter((t) => t < y).length;

const rows: any[] = [];
for (const m of MODELS) {
  const f = new URL(`results/${m.key}.jsonl`, import.meta.url);
  if (!existsSync(f)) continue;
  const ans = new Map<string, any>();
  for (const l of readFileSync(f, "utf8").trim().split("\n").filter(Boolean)) { const r = JSON.parse(l); ans.set(r.id, r); }
  const all = [...ans.values()];
  const ms = all.map((r) => r.ms);
  const costs = all.filter((r) => typeof r.cost === "number").map((r) => r.cost);
  const errs = all.filter((r) => r.guess !== null).map((r) => Math.abs(r.guess - r.year));

  let placements = 0, correct = 0, complete = true;
  const scores: number[] = [];
  const capped: boolean[] = [];
  const gameSecs: number[] = [];
  for (const g of games) {
    let lives = 3, score = 0, secs = 0, done = false;
    for (let k = 1; k < g.length; k++) {
      const a = ans.get(g[k].id);
      if (!a) { complete = false; break; }
      const years = g.slice(0, k).map((c) => c.year);
      const ok = a.guess !== null && pos(years, a.guess) === pos(years, g[k].year);
      placements++; if (ok) correct++;
      if (!done) { secs += a.ms / 1000; if (ok) score++; else if (--lives === 0) done = true; }
    }
    scores.push(score); capped.push(!done); gameSecs.push(secs);
  }
  // Early-game accuracy: cards 2..25 of every game, a set every model has answered.
  let e = 0, eOk = 0;
  for (const g of games)
    for (let k = 1; k < 25; k++) {
      const a = ans.get(g[k].id);
      if (!a) continue;
      const years = g.slice(0, k).map((c) => c.year);
      e++; if (a.guess !== null && pos(years, a.guess) === pos(years, g[k].year)) eOk++;
    }
  const n = all.length;
  rows.push({
    key: m.key, label: m.label, kind: m.kind, provider: m.provider ?? m.kind, note: m.note ?? "",
    answered: n, unparsed: all.filter((r) => r.guess === null).length, complete,
    placeAcc: placements ? correct / placements : null,
    earlyAcc: e ? eOk / e : null, earlyN: e,
    meanScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    medScore: pct(scores, 0.5), bestScore: Math.max(...scores), cappedGames: capped.filter(Boolean).length,
    scores,
    exact: all.filter((r) => r.guess === r.year).length / n,
    within10: errs.filter((e) => e <= 10).length / n,
    medYearErr: pct(errs, 0.5),
    p50ms: pct(ms, 0.5), p90ms: pct(ms, 0.9),
    secsPerGame: gameSecs.reduce((a, b) => a + b, 0) / gameSecs.length,
    costPer1k: costs.length ? (costs.reduce((a, b) => a + b, 0) / costs.length) * 1000 : (m.kind === "ollama" || m.kind.endsWith("cli") ? 0 : null),
  });
}
rows.sort((a, b) => b.meanScore - a.meanScore);
writeFileSync(new URL("results/summary.json", import.meta.url), JSON.stringify({ games: games.length, cardsPerGame: games[0].length, rows }, null, 1));
const f = (x: any, d = 0) => (x === null || x === undefined ? "-" : typeof x === "number" ? x.toFixed(d) : x);
console.log("model".padEnd(40), "n".padStart(4), "score".padStart(6), "med".padStart(4), "place%".padStart(7), "early%".padStart(7), "exact%".padStart(7), "±10y%".padStart(6), "medErr".padStart(7), "p50ms".padStart(6), "p90ms".padStart(6), "$/1k".padStart(7));
for (const r of rows)
  console.log(r.label.slice(0, 40).padEnd(40), f(r.answered).padStart(4), f(r.meanScore, 1).padStart(6), f(r.medScore).padStart(4), f(r.placeAcc * 100, 1).padStart(7), f(r.earlyAcc * 100, 1).padStart(7), f(r.exact * 100, 1).padStart(7), f(r.within10 * 100, 0).padStart(6), f(r.medYearErr).padStart(7), f(r.p50ms).padStart(6), f(r.p90ms).padStart(6), f(r.costPer1k, 3).padStart(7), r.complete ? "" : "(partial)");
