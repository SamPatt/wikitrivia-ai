// The modern prompt and the parser are shared with the app.
import { DATE_PROPS, type Card } from "../lib/ai.ts";
export { SYSTEM, modernPrompt, parseYear } from "../lib/ai.ts";

// Verbatim shape of the 2024 prompt from the original components/board.tsx
export function legacyPrompt(c: Card) {
  const ev = DATE_PROPS[c.date_prop_id] ?? c.date_prop_id;
  return `You are playing a historical trivia game. Your task is to determine the year when this ocurred:
    "${ev}: ${c.label}", described as "${c.description}". Please predict two possible years for when this event could have occurred, providing a brief explanation for each guess. Your explanation should begin with whether this event ocurred BCE or CE, then fill in the yearGuess field with a corresponding integer value. If the year is after 0 (AD or CE) respond with a single positive integer (examples: 14, 570, 1969). If the year is before 0 (BC or BCE) respond with a single negative integer, and do not include commas in the years (examples: -15000, -1350, -460). Conclude by selecting the year you believe is most accurate from your guesses. Do not include any additional text or comments in your response, respond solely with valid JSON - including a closing bracket - in the following JSON format, filling in the final "year" field with your best guess:
    {
        "guesses": [
            {"explanation": , "yearOneGuess":},
            {"explanation": , "yearTwoGuess":}
        ],
        "year":"
    }`;
}
