// Translation via OpenRouter (OpenAI-compatible API).
// OpenRouter gives access to many models through one endpoint. We use a
// free/cheap instruct model and prompt it to translate a single word/phrase.

import { LANGUAGE_MAP } from "../models/languages";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// A capable, low-cost model. Swap for any model id from openrouter.ai/models.
// ":free" variants cost nothing but are rate-limited.
const TRANSLATION_MODEL = "meta-llama/llama-3.3-70b-instruct";

export interface TranslateParams {
  text: string;
  sourceLang: string; // ISO 639-1
  targetLang: string; // ISO 639-1
}

function langName(code: string): string {
  return LANGUAGE_MAP[code]?.name ?? code;
}

export async function translate({
  text,
  sourceLang,
  targetLang,
}: TranslateParams): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const source = langName(sourceLang);
  const target = langName(targetLang);

  // Tight prompt: we want ONLY the translation back, nothing else.
  const systemPrompt =
    "You are a precise translation engine. You translate a single word or short " +
    "phrase and reply with ONLY the translation — no quotes, no explanation, no " +
    "punctuation unless part of the translation. If multiple common translations " +
    "exist, give the single most common one.";

  const userPrompt = `Translate this from ${source} to ${target}:\n\n${text}`;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Optional but recommended by OpenRouter for analytics / ranking
      "HTTP-Referer": process.env.APP_URL ?? "https://linguana.app",
      "X-Title": "Linguana",
    },
    body: JSON.stringify({
      model: TRANSLATION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Translation failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const translation = data.choices?.[0]?.message?.content?.trim();

  if (!translation) {
    throw new Error("Empty translation response");
  }

  return translation;
}