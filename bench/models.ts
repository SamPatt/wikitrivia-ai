// One entry per contestant. `kind` picks the transport in providers.ts.
export interface ModelSpec {
  key: string; // short id used for result files
  label: string;
  kind: "openrouter" | "gemini" | "xai" | "anthropic" | "ollama" | "claude-cli" | "codex-cli";
  model: string;
  provider?: string; // OpenRouter provider pin (Groq, Cerebras, SambaNova…)
  extra?: Record<string, unknown>;
  prompt?: "modern" | "legacy2024";
  note?: string;
}

const pin = (model: string, provider: string, extra?: Record<string, unknown>) => ({ model, provider, extra });

export const MODELS: ModelSpec[] = [
  // ---- 2024 baseline: closest thing to the original llama3-70b-8192 on Groq, original prompt
  { key: "llama70-groq-legacy", label: "Llama 3.3 70B @ Groq (2024 prompt)", kind: "openrouter", ...pin("meta-llama/llama-3.3-70b-instruct", "Groq"), prompt: "legacy2024", note: "the original setup" },
  { key: "llama70-groq", label: "Llama 3.3 70B @ Groq", kind: "openrouter", ...pin("meta-llama/llama-3.3-70b-instruct", "Groq") },
  { key: "llama8-groq", label: "Llama 3.1 8B @ Groq", kind: "openrouter", ...pin("meta-llama/llama-3.1-8b-instruct", "Groq") },
  { key: "deepseek-v4.1-flash-together", label: "DeepSeek V4.1 Flash @ Together", kind: "openrouter", ...pin("deepseek/deepseek-v4.1-flash", "together", { reasoning: { enabled: false } }) },
  // ---- fast-silicon hosts (via OpenRouter, pinned)
  { key: "gptoss120-cerebras", label: "gpt-oss-120b @ Cerebras", kind: "openrouter", ...pin("openai/gpt-oss-120b", "Cerebras", { reasoning: { effort: "low" } }) },
  { key: "gptoss120-groq", label: "gpt-oss-120b @ Groq", kind: "openrouter", ...pin("openai/gpt-oss-120b", "Groq", { reasoning: { effort: "low" } }) },
  { key: "gptoss120-groq-med", label: "gpt-oss-120b @ Groq (medium reasoning)", kind: "openrouter", ...pin("openai/gpt-oss-120b", "Groq", { reasoning: { effort: "medium" } }) },
  { key: "gpt-5.6-luna-low", label: "GPT-5.6 Luna (low reasoning)", kind: "openrouter", model: "openai/gpt-5.6-luna", extra: { reasoning: { effort: "low" } } },
  { key: "gptoss20-groq", label: "gpt-oss-20b @ Groq", kind: "openrouter", ...pin("openai/gpt-oss-20b", "Groq", { reasoning: { effort: "low" } }) },
  { key: "qwen38-cerebras", label: "Qwen3.8 27B @ Cerebras", kind: "openrouter", ...pin("qwen/qwen3.8-27b", "Cerebras", { reasoning: { enabled: false } }) },
  { key: "gemma4-sambanova", label: "Gemma 4 31B @ SambaNova", kind: "openrouter", ...pin("google/gemma-4-31b-it", "SambaNova") },
  { key: "minimax-flash-sambanova", label: "MiniMax M3.1 Flash @ SambaNova", kind: "openrouter", ...pin("minimax/minimax-m3.1-flash", "SambaNova", { reasoning: { effort: "low" } }) },
  // ---- Google direct (free tier on your key)
  { key: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", kind: "gemini", model: "gemini-3.5-flash-lite", extra: { reasoning_effort: "minimal" } },
  { key: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", kind: "gemini", model: "gemini-3.1-flash-lite", extra: { reasoning_effort: "minimal" } },
  { key: "gemini-3.8-flash", label: "Gemini 3.8 Flash (via OpenRouter)", kind: "openrouter", model: "google/gemini-3.8-flash", extra: { reasoning: { effort: "low" } } },
  // ---- frontier labs, thinking off / lowest
  { key: "haiku-5.5", label: "Claude Haiku 5.5", kind: "openrouter", model: "anthropic/claude-haiku-5.5", extra: { reasoning: { enabled: false } } },
  { key: "sonnet-5.5", label: "Claude Sonnet 5.5", kind: "openrouter", model: "anthropic/claude-sonnet-5.5", extra: { reasoning: { effort: "low" } } },
  { key: "opus-5.5", label: "Claude Opus 5.5", kind: "openrouter", model: "anthropic/claude-opus-5.5", extra: { reasoning: { effort: "low" } } },
  { key: "grok-4.20-nr", label: "Grok 4.20 (non-reasoning)", kind: "xai", model: "grok-4.20-0309-non-reasoning" },
  { key: "gpt-5.4-nano", label: "GPT-5.4 nano", kind: "openrouter", model: "openai/gpt-5.4-nano", extra: { reasoning: { effort: "none" } } },
  { key: "gpt-5.6-luna", label: "GPT-5.6 Luna", kind: "openrouter", model: "openai/gpt-5.6-luna", extra: { reasoning: { effort: "none" } } },
  // ---- local, free (RTX 4090)
  { key: "ollama-gemma3-1b", label: "Gemma 3 1B (local 4090)", kind: "ollama", model: "gemma3:1b" },
  { key: "ollama-qwen3.8", label: "Qwen3.8 27B (local 4090)", kind: "ollama", model: "qwen3.8:latest" },
  // ---- subscriptions (CLI round trip)
  { key: "claude-cli-haiku", label: "Claude Code CLI (haiku, subscription)", kind: "claude-cli", model: "haiku" },
  { key: "codex-cli", label: "Codex CLI (subscription)", kind: "codex-cli", model: "default" },
];
