import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "node:child_process";
import type { ModelSpec } from "./models.ts";

export interface CallResult { text: string; ms: number; inTok?: number; outTok?: number; cost?: number; served?: string }

const anthropic = new Anthropic({ maxRetries: 2 });

async function openaiCompat(url: string, key: string | undefined, body: Record<string, unknown>) {
  for (let attempt = 0; ; attempt++) {
    const t0 = performance.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify(body),
    });
    const ms = performance.now() - t0;
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    const j: any = await res.json();
    if (!res.ok || j.error) throw new Error(`${res.status} ${JSON.stringify(j.error ?? j).slice(0, 300)}`);
    return { j, ms };
  }
}

function run(cmd: string, args: string[], input?: string, envOverride: Record<string, string | undefined> = {}): Promise<string> {
  const env = { ...process.env, ...envOverride };
  for (const k in envOverride) if (envOverride[k] === undefined) delete env[k];
  return new Promise((resolve, reject) => {
    const p = execFile(cmd, args, { timeout: 120_000, maxBuffer: 1 << 20, cwd: "/tmp", env }, (err, out, errOut) =>
      err ? reject(new Error(errOut || String(err))) : resolve(out),
    );
    if (input !== undefined) p.stdin!.end(input);
  });
}

export async function call(m: ModelSpec, system: string, user: string): Promise<CallResult> {
  const messages = [{ role: "system", content: system }, { role: "user", content: user }];
  const maxTok = m.prompt === "legacy2024" ? 400 : 24;

  switch (m.kind) {
    case "openrouter": {
      const body: any = { model: m.model, messages, max_tokens: m.extra?.reasoning ? 1500 : maxTok, temperature: 0, usage: { include: true }, ...m.extra };
      if (m.provider) body.provider = { order: [m.provider], allow_fallbacks: false };
      const { j, ms } = await openaiCompat("https://openrouter.ai/api/v1/chat/completions", process.env.OPENROUTER_API_KEY, body);
      return { text: j.choices[0].message.content ?? "", ms, inTok: j.usage?.prompt_tokens, outTok: j.usage?.completion_tokens, cost: j.usage?.cost, served: j.provider };
    }
    case "gemini": {
      const body = { model: m.model, messages, max_tokens: m.extra?.reasoning_effort === "low" ? 600 : maxTok, temperature: 0, ...m.extra };
      const { j, ms } = await openaiCompat("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", process.env.GOOGLE_API_KEY, body);
      return { text: j.choices[0].message.content ?? "", ms, inTok: j.usage?.prompt_tokens, outTok: j.usage?.completion_tokens };
    }
    case "xai": {
      const body = { model: m.model, messages, max_tokens: maxTok, temperature: 0 };
      const { j, ms } = await openaiCompat("https://api.x.ai/v1/chat/completions", process.env.XAI_API_KEY, body);
      return { text: j.choices[0].message.content ?? "", ms, inTok: j.usage?.prompt_tokens, outTok: j.usage?.completion_tokens };
    }
    case "ollama": {
      const t0 = performance.now();
      const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        body: JSON.stringify({ model: m.model, messages, stream: false, think: false, keep_alive: "30m", options: { temperature: 0, num_predict: maxTok } }),
      });
      const j: any = await res.json();
      if (j.error) throw new Error(j.error);
      return { text: j.message?.content ?? "", ms: performance.now() - t0, inTok: j.prompt_eval_count, outTok: j.eval_count, cost: 0 };
    }
    case "anthropic": {
      // Haiku 5.5 accepts thinking disabled at effort <= high; Sonnet 5.5 turns
      // thinking off with between_tools instead.
      const thinking = m.model.startsWith("claude-sonnet-5-5") ? { type: "between_tools" } : { type: "disabled" };
      const t0 = performance.now();
      const r = await anthropic.messages.create({
        model: m.model,
        max_tokens: m.prompt === "legacy2024" ? 400 : 32,
        system,
        messages: [{ role: "user", content: user }],
        thinking: thinking as any,
        output_config: { effort: "low" },
      } as any);
      const text = r.content.flatMap((b: any) => (b.type === "text" ? [b.text] : [])).join("");
      return { text, ms: performance.now() - t0, inTok: r.usage.input_tokens, outTok: r.usage.output_tokens };
    }
    case "claude-cli": {
      const t0 = performance.now();
      const out = await run("claude", ["-p", user, "--model", m.model, "--system-prompt", system, "--tools="], "", { ANTHROPIC_API_KEY: undefined });
      return { text: out, ms: performance.now() - t0, cost: 0 };
    }
    case "codex-cli": {
      const t0 = performance.now();
      const out = await run("codex", ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "-c", "model_reasoning_effort=low", `${system}\n\n${user}`], "");
      const lines = out.trim().split("\n");
      return { text: lines[lines.length - 1], ms: performance.now() - t0, cost: 0 };
    }
  }
}
