import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/app/src/lib/mongodb";
import { getSessionUser, refreshSession } from "@/app/src/lib/jwt";

async function requireUser() {
  let session = await getSessionUser();
  if (!session) session = await refreshSession();
  return session;
}

// Upsert a word into the global dictionary and return its _id.
// Mirrors the pattern used by the decks routes: one document per
// (value, language), translations merged into a per-target-language map.
async function upsertWord(
  db: Awaited<ReturnType<typeof getDb>>,
  value: string,
  translation: string,
  sourceLang: string,
  targetLang: string,
  now: Date
): Promise<ObjectId> {
  const wordValue = value.trim();
  const translationValue = translation.trim();

  const existing = await db.collection("words").findOne({
    value: wordValue,
    language: sourceLang,
  });

  if (existing) {
    if (translationValue) {
      const current: string[] = existing.translations?.[targetLang] ?? [];
      if (!current.includes(translationValue)) {
        await db.collection("words").updateOne(
          { _id: existing._id },
          { $set: { [`translations.${targetLang}`]: [...current, translationValue] } }
        );
      }
    }
    return existing._id;
  }

  const insertResult = await db.collection("words").insertOne({
    value: wordValue,
    language: sourceLang,
    translations: translationValue ? { [targetLang]: [translationValue] } : {},
    createdAt: now,
  });
  return insertResult.insertedId;
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
// Saves a word to the user's collection. If the same (word, targetLang)
// already exists, its translation is refreshed instead of duplicated.
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

    const wordId = await upsertWord(db, word, translation, sourceLang, targetLang, now);

    const result = await db.collection("savedWords").findOneAndUpdate(
      { userId, wordId, targetLanguage: targetLang },
      {
        $set: {
          word: word.trim(),
          translation: translation.trim(),
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          updatedAt: now,
        },
        $setOnInsert: { userId, wordId, createdAt: now },
      },
      { upsert: true, returnDocument: "after" }
    );

    const saved = result;
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
