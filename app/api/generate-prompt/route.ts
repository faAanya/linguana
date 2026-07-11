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
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const SYSTEM_PROMPT = `You generate vocabulary flashcards from a user's request.

The user will describe what words they want (e.g. "20 flashcards with names of plants in English", or "common cooking verbs in Spanish").

Rules:
- Generate ONLY the words/terms in the language the user specifies. Do NOT translate them.
- If the user gives a count, produce exactly that many. If not, produce a sensible number (10–15).
- Each item is a single word or short phrase — no definitions, no numbering.
- Leave the translation empty; the user will translate later.

Return ONLY a JSON object in this exact format, no markdown, no extra text:
{
  "pairs": [
    { "word": "...", "translation": "" },
    ...
  ]
}

If the request is unclear or you cannot generate words, return:
{ "pairs": [] }`;

// POST /api/generate-prompt — { prompt }
export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt } = await request.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content ?? "";
    const cleaned = content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    let parsed: { pairs: { word: string; translation: string }[] };
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
    console.error("Generate prompt error:", err);
    return NextResponse.json({ error: "Failed to generate flashcards" }, { status: 500 });
  }
}