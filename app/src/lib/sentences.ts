// Generates a single example sentence for a vocabulary word. Both display
// renderings (full word sentence + native-translation masked sentence) come
// from ONE generation so switching modes never regenerates the content.

import OpenAI from "openai";
import type { ExampleSentence } from "@/app/src/models/domain";

let openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

const SYSTEM_PROMPT = `You create ONE example sentence to help someone learn a vocabulary word.

You are given: a WORD (in the language being learned) and its TRANSLATION (in the learner's native language).

Produce:
- "full": a natural sentence in the WORD's language that uses the WORD, e.g. "I bought an apple yesterday."
- "masked": the same sentence with the WORD replaced by its TRANSLATION wrapped in square brackets, e.g. "I bought an [яблоко] yesterday."
- "answer": the original WORD that belongs in the bracket.
- "fullTranslation": the ENTIRE "full" sentence translated into the learner's native language (the TRANSLATION's language), e.g. "Я вчера купил яблоко."

The "full" and "masked" sentences must be identical except for that one substituted word.

Return ONLY a JSON object, no markdown:
{ "full": "...", "masked": "...", "answer": "...", "fullTranslation": "..." }`;

export async function generateSentence(
  word: string,
  translation: string
): Promise<ExampleSentence> {
  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `WORD: ${word}\nTRANSLATION: ${translation || "(none provided)"}`,
      },
    ],
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content ?? "";
  const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  const parsed = JSON.parse(cleaned) as Partial<ExampleSentence>;
  if (!parsed.full || !parsed.masked) {
    throw new Error("Incomplete sentence generation");
  }

  return {
    full: parsed.full,
    masked: parsed.masked,
    answer: parsed.answer ?? word,
    fullTranslation: parsed.fullTranslation ?? "",
  };
}
