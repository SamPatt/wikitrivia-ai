// Builds a fixed, seeded set of games using the same card-selection rules as the
// web app (components/game.tsx filters + lib/items.ts getRandomItem/tooClose).
// Because the next card never depends on whether the AI was right, every model
// can be scored on identical card sequences.
import { readFileSync, writeFileSync } from "node:fs";

export interface Item {
  date_prop_id: string;
  description: string;
  id: string;
  instance_of: string[];
  label: string;
  year: number;
  wikipedia_title: string;
}

const root = new URL("..", import.meta.url).pathname;

function loadBadCards(): Set<string> {
  const src = readFileSync(root + "lib/bad-cards.ts", "utf8");
  return new Set([...src.matchAll(/^\s*(Q\d+):/gm)].map((m) => m[1]));
}

export function loadDeck(): Item[] {
  const bad = loadBadCards();
  return readFileSync(root + "public/data/items.json", "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Item)
    .filter((i) => !i.label.includes(String(i.year)))
    .filter((i) => !i.description.includes(String(i.year)))
    .filter((i) => !["st century", "nd century", "th century"].some((t) => i.description.includes(t)))
    .filter((i) => !bad.has(i.id));
}

// mulberry32
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tooClose(item: Item, played: Item[]) {
  let distance = played.length < 40 ? 5 : 1;
  if (played.length < 11) distance = 110 - 10 * played.length;
  return played.some((p) => Math.abs(item.year - p.year) < distance);
}

function getRandomItem(deck: Item[], played: Item[], r: () => number): Item {
  const periods: [number, number][] = [[-100000, 1000], [1000, 1800], [1800, 2020]];
  const [from, to] = periods[Math.floor(r() * periods.length)];
  const avoidPeople = r() > 0.5;
  const ids = new Set(played.map((p) => p.id));
  const c = deck.filter(
    (x) =>
      !ids.has(x.id) &&
      !(avoidPeople && x.instance_of.includes("human")) &&
      x.year >= from && x.year <= to &&
      !tooClose(x, played),
  );
  if (c.length) return c[Math.floor(r() * c.length)];
  return deck[Math.floor(r() * deck.length)];
}

export function makeGames(n: number, len: number, seed = 2026) {
  const deck = loadDeck();
  const games: Item[][] = [];
  for (let g = 0; g < n; g++) {
    const r = rng(seed + g * 7919);
    const seq: Item[] = [];
    for (let k = 0; k < len; k++) seq.push(getRandomItem(deck, seq, r));
    games.push(seq);
  }
  return games;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] ?? 10);
  const len = Number(process.argv[3] ?? 40);
  const games = makeGames(n, len);
  const slim = games.map((g) =>
    g.map(({ id, label, description, date_prop_id, year, instance_of }) => ({ id, label, description, date_prop_id, year, instance_of })),
  );
  writeFileSync(new URL("games.json", import.meta.url), JSON.stringify(slim, null, 0));
  const uniq = new Set(games.flat().map((i) => i.id));
  console.log(`${n} games x ${len} cards, ${uniq.size} unique cards`);
}
