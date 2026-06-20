import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
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

    const response = await openai.chat.completions.create({
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
              text: `Please read this image carefully. It contains vocabulary entries in the format "word - translation" (one per line).

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
{ "pairs": [], "rawText": "" }`,
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content ?? "";
    const cleaned = content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    let parsed: { pairs: { word: string; translation: string }[]; rawText: string };
    try {
      parsed = JSON.parse(cleaned);
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
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}