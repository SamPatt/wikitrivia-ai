// Drops cached answers whose reply was not a bare integer (they were stored
// truncated and parsed with the old first-number rule) so run.ts re-asks them.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
for (const f of readdirSync("results").filter((f) => f.endsWith(".jsonl") && !f.includes("legacy"))) {
  const lines = readFileSync(`results/${f}`, "utf8").trim().split("\n").filter(Boolean);
  const keep = lines.filter((l) => /^\s*-?\d{1,6}\s*$/.test(JSON.parse(l).text.replace(/(\d),(\d{3})/g, "$1$2")));
  if (keep.length !== lines.length) {
    writeFileSync(`results/${f}`, keep.join("\n") + "\n");
    console.log(f, "dropped", lines.length - keep.length);
  }
}
