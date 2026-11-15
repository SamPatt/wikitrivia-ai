import type { NextApiRequest, NextApiResponse } from "next";
import { AI_MODELS, askYear } from "../../lib/ai";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") return res.json(AI_MODELS.map(({ id, label }) => ({ id, label })));
  if (req.method !== "POST") return res.status(405).end();

  const { modelId, card } = req.body ?? {};
  const m = AI_MODELS.find((x) => x.id === modelId);
  if (!m || !card?.label) return res.status(400).json({ error: "modelId and card are required" });

  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await askYear(m, card);
      if (r.year !== null) return res.json(r);
      lastErr = `unparseable reply: ${r.text}`;
    } catch (e) {
      lastErr = (e as Error).message;
      await new Promise((ok) => setTimeout(ok, 500 * (attempt + 1)));
    }
  }
  res.status(502).json({ error: lastErr });
}
