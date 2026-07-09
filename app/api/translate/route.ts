import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, refreshSession } from "@/app/src/lib/jwt";
import { translate } from "@/app/src/lib/translation";

async function requireUser() {
  let session = await getSessionUser();
  if (!session) session = await refreshSession();
  return session;
}

// POST /api/translate
// Body: { items: [{ text }], sourceLang, targetLang }
// Returns: { translations: [{ text, translation }] }
// Handles both single and batch (array of items) in one call.
export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { items, sourceLang, targetLang } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items to translate" }, { status: 400 });
    }
    if (!sourceLang || !targetLang) {
      return NextResponse.json(
        { error: "sourceLang and targetLang are required" },
        { status: 400 }
      );
    }

    // Translate sequentially to stay within HF free-tier rate limits.
    // (Batch parallelism can trip rate limiting on the free Inference API.)
    const translations: { text: string; translation: string }[] = [];
    for (const item of items) {
      const text = typeof item === "string" ? item : item.text;
      if (!text?.trim()) {
        translations.push({ text: text ?? "", translation: "" });
        continue;
      }
      const translation = await translate({ text, sourceLang, targetLang });
      translations.push({ text, translation });
    }

    return NextResponse.json({ translations });
  } catch (err) {
    console.error("Translate error:", err);
    const message = err instanceof Error ? err.message : "Translation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}