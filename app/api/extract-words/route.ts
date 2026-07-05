import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

const IMAGE_PROMPT = `Please read this image carefully. It contains vocabulary entries in the format "word - translation" (one per line).

Extract all word pairs exactly as written, preserving the original spelling and punctuation.

Return ONLY a JSON object in this exact format, with no extra text or markdown:
{
  "pairs": [
    { "word": "...", "translation": "..." },
    ...
  ],
  "rawText": "the full text you read from the image, line by line"
}

If you cannot read the image or find no word pairs, return:
{ "pairs": [], "rawText": "" }`;

// Text mode prompt is different: the user may paste free-form text rather than
// a clean "word - translation" list, so the model needs to actively find or
// infer vocabulary pairs (e.g. a word and its translation/definition mentioned
// anywhere in the passage), not just parse a fixed line format.
const TEXT_PROMPT = `The user pasted the text below. It may already be in "word - translation" format,
or it may be free-form text (sentences, a paragraph, a mixed list) that contains
vocabulary words alongside their translations or meanings somewhere in the text.

Find or infer all word/translation pairs you can identify in this text.
- If the text is already line-based "word - translation", extract them directly.
- If it's free-form, identify candidate vocabulary words and pair each with its
  most likely translation or meaning as given in the text.
- Preserve original spelling.

Return ONLY a JSON object in this exact format, with no extra text or markdown:
{
  "pairs": [
    { "word": "...", "translation": "..." },
    ...
  ],
  "rawText": "the original text, unchanged"
}

If you find no usable word pairs, return:
{ "pairs": [], "rawText": "<the original text>" }

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