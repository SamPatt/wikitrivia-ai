// Ranks stage-1 probe results: accurate endpoints (>= 13/16 within 10 years), fastest first.
import { readdirSync, readFileSync } from "node:fs";
const dir = new URL("probe/", import.meta.url);
const min = Number(process.argv[2] ?? 13);
const rows = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => {
  const rs = readFileSync(new URL(f, dir), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const ok = rs.filter((r) => !r.error);
  const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
  return {
    ep: f.replace(".jsonl", ""), n: ok.length, errors: rs.length - ok.length,
    w10: ok.filter((r) => r.guess !== null && Math.abs(r.guess - r.year) <= 10).length,
    exact: ok.filter((r) => r.guess === r.year).length,
    p50: ms.length ? Math.round(ms[Math.floor(ms.length / 2)]) : null,
    p90: ms.length ? Math.round(ms[Math.floor(ms.length * 0.9)]) : null,
    cost1k: ok.some((r) => r.cost) ? (ok.reduce((a, r) => a + (r.cost ?? 0), 0) / ok.length) * 1000 : null,
    err: rs.find((r) => r.error)?.error?.slice(0, 60) ?? "",
  };
});
const good = rows.filter((r) => r.n >= 14 && r.w10 >= min).sort((a, b) => a.p50! - b.p50!);
console.log(`${rows.length} endpoints probed, ${rows.filter((r) => r.n >= 14).length} answered, ${good.length} accurate (>=${min}/16 within 10y)\n`);
console.log("endpoint".padEnd(62), "w10".padStart(4), "exact".padStart(5), "p50".padStart(6), "p90".padStart(6), "$/1k".padStart(7));
for (const r of good.slice(0, Number(process.argv[3] ?? 40)))
  console.log(r.ep.slice(0, 62).padEnd(62), String(r.w10).padStart(4), String(r.exact).padStart(5), String(r.p50).padStart(6), String(r.p90).padStart(6), (r.cost1k === null ? "-" : r.cost1k.toFixed(3)).padStart(7));
