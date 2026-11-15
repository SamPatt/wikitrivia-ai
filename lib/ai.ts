// Shared by the app (pages/api/guess.ts) and the benchmark (bench/).
// Every contestant speaks the OpenAI chat-completions dialect, so one fetch covers them all.

export interface AIModel {
  id: string;
  label: string;
  host: "openrouter" | "gemini" | "xai" | "ollama";
  model: string;
  provider?: string; // OpenRouter provider pin
  extra?: Record<string, unknown>;
  blurb?: string;
}

// Ordered fastest-good first; see bench/results/summary.json for the numbers.
export const AI_MODELS: AIModel[] = [
  { id: "deepseek-v4.1-flash-together", label: "DeepSeek V4.1 Flash · Together", host: "openrouter", model: "deepseek/deepseek-v4.1-flash", provider: "together", extra: { reasoning: { enabled: false } } },
  { id: "gptoss120-groq", label: "gpt-oss-120b · Groq", host: "openrouter", model: "openai/gpt-oss-120b", provider: "Groq", extra: { reasoning: { effort: "low" } } },
  { id: "opus-5.5", label: "Claude Opus 5.5 (most accurate)", host: "openrouter", model: "anthropic/claude-opus-5.5", extra: { reasoning: { effort: "low" } } },
  { id: "gptoss120-cerebras", label: "gpt-oss-120b · Cerebras", host: "openrouter", model: "openai/gpt-oss-120b", provider: "Cerebras", extra: { reasoning: { effort: "low" } } },
  { id: "llama70-groq", label: "Llama 3.3 70B · Groq (2024 baseline)", host: "openrouter", model: "meta-llama/llama-3.3-70b-instruct", provider: "Groq" },
  { id: "llama8-groq", label: "Llama 3.1 8B · Groq", host: "openrouter", model: "meta-llama/llama-3.1-8b-instruct", provider: "Groq" },
  { id: "qwen38-cerebras", label: "Qwen3.8 27B · Cerebras", host: "openrouter", model: "qwen/qwen3.8-27b", provider: "Cerebras", extra: { reasoning: { enabled: false } } },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (free tier)", host: "gemini", model: "gemini-3.5-flash-lite", extra: { reasoning_effort: "minimal" } },
  { id: "haiku-5.5", label: "Claude Haiku 5.5", host: "openrouter", model: "anthropic/claude-haiku-5.5", extra: { reasoning: { enabled: false } } },
  { id: "grok-4.20-nr", label: "Grok 4.20 non-reasoning", host: "xai", model: "grok-4.20-0309-non-reasoning" },
  { id: "ollama-qwen3.8", label: "Qwen3.8 27B · local GPU (free)", host: "ollama", model: "qwen3.8:latest" },
];

export const DATE_PROPS: Record<string, string> = {
  P575: "discovered", P7589: "date of assent", P577: "published", P1191: "first performed",
  P1619: "officially opened", P571: "created / founded", P1249: "earliest record", P576: "ended",
  P8556: "became extinct", P6949: "announced", P1319: "earliest", P569: "born", P570: "died",
  P582: "ended", P580: "started", P7125: "latest one", P7124: "first one",
};

export interface Card { label: string; description: string; date_prop_id: string }

export const SYSTEM =
  "You date historical trivia cards. Reply with only the year as an integer: negative for BCE (e.g. -480), positive for CE (e.g. 1969). No words, no commas.";

export function modernPrompt(c: Card) {
  const ev = DATE_PROPS[c.date_prop_id] ?? c.date_prop_id;
  return `${c.label} (${c.description}) — year ${ev}?`;
}

export function parseYear(text: string, legacy = false): number | null {
  if (!text) return null;
  if (legacy) {
    const m = text.match(/"year"\s*:\s*"?(-?\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  const t = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/(\d),(\d{3})/g, "$1$2").trim();
  if (/^-?\d{1,6}$/.test(t)) return parseInt(t, 10);
  // Chatty reply ("Born 20 August 1685. … 1685"): the answer is the last number,
  // and "BCE" counts only if it sits right after that number.
  const all = Array.from(t.matchAll(/(-?\d{1,6})(\s*(BCE|BC|B\.C\.))?/gi));
  if (!all.length) return null;
  const last = all[all.length - 1];
  let y = parseInt(last[1], 10);
  if (last[3] && y > 0) y = -y;
  return y;
}

const HOSTS = {
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", key: "OPENROUTER_API_KEY" },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: "GOOGLE_API_KEY" },
  xai: { url: "https://api.x.ai/v1/chat/completions", key: "XAI_API_KEY" },
  ollama: { url: `${process.env.OLLAMA_URL ?? "http://localhost:11434"}/v1/chat/completions`, key: "" },
} as const;

/** Server-side only: reads API keys from process.env. */
export async function askYear(m: AIModel, card: Card) {
  const host = HOSTS[m.host];
  const thinks = Boolean(m.extra?.reasoning);
  const body: Record<string, unknown> = {
    model: m.model,
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: modernPrompt(card) }],
    max_tokens: thinks ? 1500 : 24,
    temperature: 0,
    ...m.extra,
  };
  if (m.provider) body.provider = { order: [m.provider], allow_fallbacks: false };
  if (m.host === "ollama") body.reasoning_effort = "none";
  const key = host.key ? process.env[host.key] : undefined;
  if (host.key && !key) throw new Error(`${host.key} is not set (add it to .env.local)`);

  const t0 = performance.now();
  const res = await fetch(host.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body),
  });
  const ms = performance.now() - t0;
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(`${m.host} ${res.status}: ${JSON.stringify(j.error ?? j).slice(0, 200)}`);
  const text: string = j.choices?.[0]?.message?.content ?? "";
  return { year: parseYear(text), text: text.slice(0, 80), ms, cost: j.usage?.cost as number | undefined };
}
