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
      "X-Title": "TalkiBara",
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

// Returns SEVERAL candidate translations (most common first) so the user can
// pick which one to save. De-duplicated, trimmed, capped at `max`. Nouns are
// gender-marked: an article where the target language uses one, otherwise a
// short abbreviation written in the learner's native language.
export async function translateOptions(
  { text, sourceLang, targetLang, nativeLang }: TranslateParams & { nativeLang?: string },
  max = 6
): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const source = langName(sourceLang);
  const target = langName(targetLang);
  const native = langName(nativeLang ?? sourceLang);

  const systemPrompt =
    "You are a precise bilingual dictionary. Given a word or short phrase, " +
    `return up to ${max} common ${target} translations of it, ordered from most ` +
    "to least common. Include distinct senses/synonyms when they exist.\n\n" +
    "Grammatical gender rules for NOUNS:\n" +
    `- If ${target} normally marks a noun's gender with a definite article ` +
    "(e.g. German der/die/das, French le/la, Spanish el/la, Italian il/la/lo, " +
    "Portuguese o/a, Dutch de/het), include the correct article before the noun " +
    '(e.g. "das Wort", "la palabra").\n' +
    `- If ${target} marks grammatical gender but does NOT use articles ` +
    "(e.g. Russian, Ukrainian, Polish, Czech, Belarusian, Slovak), append a short " +
    `gender abbreviation in parentheses, written in ${native} (the learner's language) — ` +
    'e.g. for an English speaker "(m.)", "(f.)", "(n.)".\n' +
    "- For all other words (verbs, adjectives, non-gendered languages like English), " +
    "add no article and no gender mark.\n\n" +
    "Reply with ONLY a JSON array of strings — no numbering, no explanations, no extra keys.";

  const userPrompt = `Translate this from ${source} to ${target}:\n\n${text}`;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL ?? "https://linguana.app",
      "X-Title": "TalkiBara",
    },
    body: JSON.stringify({
      model: TRANSLATION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Translation failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content?.trim() ?? "";

  // Prefer a JSON array; fall back to splitting on commas / newlines.
  let items: string[] = [];
  const jsonStart = content.indexOf("[");
  const jsonEnd = content.lastIndexOf("]");
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
      if (Array.isArray(parsed)) items = parsed.map((x) => String(x));
    } catch {
      /* fall through to text split */
    }
  }
  if (items.length === 0) {
    items = content.split(/[\n,]+/).map((s) => s.replace(/^[\s\d.)-]+/, ""));
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of items) {
    const v = raw.trim().replace(/^["']|["']$/g, "").trim();
    const key = v.toLowerCase();
    if (v && !seen.has(key)) {
      seen.add(key);
      unique.push(v);
    }
  }
  return unique.slice(0, max);
}