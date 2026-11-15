# WikiTrivia, AI version

I took the original and added AI. And some Llama gifs.

## 2026 update

- No separate server any more: `pages/api/guess.ts` calls the model, keys stay server-side.
- Pick the model on the start screen (Groq, Cerebras, Gemini free tier, Claude, Grok, or a local Ollama model).
- The board shows each guess vs. the real year, per-call latency, and spend.
- `?model=<id>&autostart&pace=600` skips the menu and slows the AI down for screen recording.

```bash
cp .env.example .env.local   # fill in the keys you need
npm install
npm run dev                  # http://localhost:3000
```

### Benchmark

`bench/` replays the game's own card-drawing rules with a fixed seed (12 games × 100 cards),
asks every model to date each card, and scores the games exactly as the app would.

```bash
cd bench && npm install
node deck.ts 12 100          # regenerate games.json (already committed)
node run.ts all              # answers cached in bench/results/<model>.jsonl
node report.ts               # table + results/summary.json
```

# Wiki Trivia

This is the source code for the web app at https://wikitrivia.tomjwatson.com.

The repository for the scraper can be found [here](https://github.com/tom-james-watson/wikitrivia-scraper).

## Usage

### Prerequisites

```bash
npm install
```

### Development

```bash
npm run dev
```

Then visit http://localhost:3000/ to preview the website.

### Static build

To build a static version of the website to the `out` folder, run:

```bash
npm run build
```

Then run said build with:

```bash
npm start
```

## FAQ

### Where does the data come from?

The data is all sourced from [wikidata](https://www.wikidata.org).

### I was played a card that doesn't make sense - what gives?

There are some cards that unfortunately don't quite make sense or have bad data. These need to be removed from the game and, ideally, to have their underlying wikidata entry fixed.

Please report any bad cards here: https://github.com/tom-james-watson/wikitrivia/discussions/2.
