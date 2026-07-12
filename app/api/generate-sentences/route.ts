import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionUser, refreshSession } from "@/app/src/lib/jwt";

async function requireUser() {
  let session = await getSessionUser();
  if (!session) session = await refreshSession();
  return session;
}

let openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// The model gets: a word, its translation, how many sentences to produce.
// It returns example sentences where the TARGET word is replaced by its
// translation in brackets, plus the plain answer (the bracketed word).
//
// Example for word "flinch" (en) → translation "вздрогнуть" (ru):
//   sentence: "He never [вздрогнуть] from telling the truth."
//   answer:   "flinch" (the original word that belongs in the bracket)
//   full:     "He never flinch from telling the truth." (natural sentence)
const SYSTEM_PROMPT = `You create example sentences to help someone learn a vocabulary word.

You are given: a WORD (in the language being learned), its TRANSLATION (in the learner's language), and a COUNT.

For each of COUNT sentences:
- Write a natural example sentence in the WORD's language that uses the WORD.
- Then produce a "masked" version where the WORD is replaced by its TRANSLATION wrapped in square brackets, e.g. "He never [вздрогнуть] from telling the truth."
- The learner will see the masked sentence and try to recall the original WORD.

Vary tense, context, and difficulty across sentences.

Return ONLY a JSON object, no markdown:
{
  "sentences": [
    {
      "masked": "He never [translation] from telling the truth.",
      "answer": "the original WORD that belongs in the bracket",
      "full": "He never WORD from telling the truth."
    }
  ]
}`;

// POST /api/generate-sentences — { word, translation, count }
export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { word, translation, count } = await request.json();

    if (!word?.trim()) {
      return NextResponse.json({ error: "Word is required" }, { status: 400 });
    }

    const n = Math.min(Math.max(parseInt(count) || 3, 1), 10); // clamp 1–10

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `WORD: ${word}\nTRANSLATION: ${translation || "(none provided)"}\nCOUNT: ${n}`,
        },
      ],
      max_tokens: 1200,
    });

    const content = response.choices[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed: {
      sentences: { masked: string; answer: string; full: string }[];
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse model response" },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Generate sentences error:", err);
    return NextResponse.json({ error: "Failed to generate sentences" }, { status: 500 });
  }
}