import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

const IMAGE_PROMPT = `Read the image and extract vocabulary cards from any readable text.

The image may contain:
- a list of words;
- words with translations;
- words with definitions;
- notes, tables, screenshots, textbook pages, handwritten text, etc.

Create one flashcard for every vocabulary word you can confidently identify.

Rules:
- If a translation, definition, or equivalent meaning is explicitly present, put it into "translation".
- If only a standalone word is present, create a card with an empty translation ("").
- Do NOT invent or guess translations.
- Preserve the original spelling, capitalization, punctuation, and accents.
- Ignore sentences that do not represent vocabulary items unless they clearly introduce a vocabulary word.
- If the same word appears multiple times, include it only once.

Return ONLY valid JSON in this exact format:

{
  "pairs": [
    {
      "word": "...",
      "translation": "..."
    }
  ],
  "rawText": "all text extracted from the image"
}

If no vocabulary words can be identified, return:

{
  "pairs": [],
  "rawText": ""
}`;

// Text mode prompt is different: the user may paste free-form text rather than
// a clean "word - translation" list, so the model needs to actively find or
// infer vocabulary pairs (e.g. a word and its translation/definition mentioned
// anywhere in the passage), not just parse a fixed line format.
const TEXT_PROMPT = `The user pasted text.

The text may be:
- a single word;
- a list of words;
- words with translations;
- words with definitions;
- sentences;
- paragraphs;
- notes;
- copied textbook content;
- any mixture of the above.

Extract vocabulary flashcards.

Rules:
- Every identifiable vocabulary word should become one flashcard.
- If the text explicitly contains a translation, definition, synonym, or equivalent meaning for that word, place it into "translation".
- If only the word is present, leave "translation" as an empty string ("").
- Do NOT invent or guess translations.
- Preserve the original spelling and capitalization.
- Ignore ordinary sentences unless they clearly contain vocabulary entries.
- Remove duplicate words.

Return ONLY valid JSON in this exact format:

{
  "pairs": [
    {
      "word": "...",
      "translation": "..."
    }
  ],
  "rawText": "the original text exactly as provided"
}

If no vocabulary words are found, return:

{
  "pairs": [],
  "rawText": "{{INPUT_TEXT}}"
}

TEXT:
"""
{{INPUT_TEXT}}
"""`;

interface ParsedResult {
  pairs: { word: string; translation: string }[];
  rawText: string;
}

function parseModelJson(content: string): ParsedResult {
  const cleaned = content
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  return JSON.parse(cleaned);
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    // ── Text mode ───────────────────────────────────────────
    if (contentType.includes("application/json")) {
      const { text } = await request.json();

      if (!text || !text.trim()) {
        return NextResponse.json({ error: "No text provided" }, { status: 400 });
      }

      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: TEXT_PROMPT.replace("{{INPUT_TEXT}}", text),
          },
        ],
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content ?? "";

      let parsed: ParsedResult;
      try {
        parsed = parseModelJson(content);
      } catch {
        return NextResponse.json(
          { error: "Failed to parse model response", raw: content },
          { status: 500 }
        );
      }

      return NextResponse.json(parsed);
    }

    // ── Image mode ──────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: IMAGE_PROMPT,
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content ?? "";

    let parsed: ParsedResult;
    try {
      parsed = parseModelJson(content);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse model response", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("OpenAI error:", error);
    return NextResponse.json(
      { error: "Failed to process input" },
      { status: 500 }
    );
  }
}