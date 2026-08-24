import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/app/src/lib/mongodb";
import { getSessionUser, refreshSession } from "@/app/src/lib/jwt";

async function requireUser() {
  let session = await getSessionUser();
  if (!session) session = await refreshSession();
  return session;
}

// GET /api/words — the user's saved words, newest first
export async function GET() {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();
    const words = await db
      .collection("savedWords")
      .find({ userId: new ObjectId(session.userId) })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(
      words.map((w) => ({
        id: w._id.toString(),
        word: w.word,
        translation: w.translation,
        sourceLanguage: w.sourceLanguage,
        targetLanguage: w.targetLanguage,
        createdAt: w.createdAt,
      }))
    );
  } catch (err) {
    console.error("Get words error:", err);
    return NextResponse.json({ error: "Failed to read words" }, { status: 500 });
  }
}

// POST /api/words
// Body: { word, translation, sourceLang, targetLang }
// Self-contained: nothing is shared with decks/flashcards. Re-saving the same
// (word, sourceLang, targetLang) refreshes the translation instead of duplicating.
export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const {
      word,
      translation,
      sourceLang = "unknown",
      targetLang = "unknown",
    } = (await request.json()) as {
      word: string;
      translation: string;
      sourceLang?: string;
      targetLang?: string;
    };

    if (!word?.trim()) {
      return NextResponse.json({ error: "Word is required" }, { status: 400 });
    }
    if (!translation?.trim()) {
      return NextResponse.json({ error: "Translation is required" }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date();
    const userId = new ObjectId(session.userId);

    // Each distinct translation is its own saved pair — the translation is
    // part of the key, so saving several translations of one word keeps them all.
    const saved = await db.collection("savedWords").findOneAndUpdate(
      {
        userId,
        word: word.trim(),
        translation: translation.trim(),
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      },
      {
        $set: { updatedAt: now },
        $setOnInsert: {
          userId,
          word: word.trim(),
          translation: translation.trim(),
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    if (!saved) {
      return NextResponse.json({ error: "Failed to save word" }, { status: 500 });
    }

    return NextResponse.json({
      id: saved._id.toString(),
      word: saved.word,
      translation: saved.translation,
      sourceLanguage: saved.sourceLanguage,
      targetLanguage: saved.targetLanguage,
      createdAt: saved.createdAt,
    });
  } catch (err) {
    console.error("Save word error:", err);
    return NextResponse.json({ error: "Failed to save word" }, { status: 500 });
  }
}
