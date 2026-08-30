import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/src/lib/jwt";
import { translateOptions } from "@/app/src/lib/translation";

// POST /api/translate/options
// Body: { text, sourceLang, targetLang, nativeLang? }
// Returns: { options: string[] } — several candidate translations to choose from.
export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text, sourceLang, targetLang, nativeLang } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: "No text to translate" }, { status: 400 });
    }
    if (!sourceLang || !targetLang) {
      return NextResponse.json(
        { error: "sourceLang and targetLang are required" },
        { status: 400 }
      );
    }

    if (sourceLang === targetLang) {
      return NextResponse.json({ options: [text.trim()] });
    }

    const options = await translateOptions({ text: text.trim(), sourceLang, targetLang, nativeLang });
    return NextResponse.json({ options });
  } catch (err) {
    console.error("Translate options error:", err);
    const message = err instanceof Error ? err.message : "Translation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
