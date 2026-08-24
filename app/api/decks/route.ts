import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/app/src/lib/mongodb";
import { getSessionUser, refreshSession } from "@/app/src/lib/jwt";

async function requireUser() {
  let session = await getSessionUser();
  if (!session) session = await refreshSession();
  return session;
}

export async function GET() {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();
    const decks = await db
      .collection("userDecks")
      .find({ userId: new ObjectId(session.userId) })
      .sort({ pinned: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json(
      decks.map((d) => ({
        id: d._id.toString(),
        name: d.name,
        createdAt: d.createdAt,
        cardCount: d.cardCount ?? 0,
        pinned: d.pinned ?? false,
      }))
    );
  } catch (err) {
    console.error("Get decks error:", err);
    return NextResponse.json({ error: "Failed to read decks" }, { status: 500 });
  }
}

// POST /api/decks
// Body: { name, cards: [{ word, translation }], sourceLang?, targetLang? }
// Words are embedded directly on the deck's flashcards — nothing is shared
// with other decks or with the "My words" collection.
export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const {
      name,
      cards,
      sourceLang = "unknown",
      targetLang = "unknown",
    } = await request.json() as {
      name: string;
      cards: { word: string; translation: string }[];
      sourceLang?: string;
      targetLang?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Deck name is required" }, { status: 400 });
    }
    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: "No cards provided" }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date();
    const userId = new ObjectId(session.userId);

    const cleaned = cards
      .map((c) => ({ word: c.word.trim(), translation: c.translation.trim() }))
      .filter((c) => c.word);

    if (cleaned.length === 0) {
      return NextResponse.json({ error: "No cards provided" }, { status: 400 });
    }

    // ── Create the deck ────────────────────────────────────────────
    const deckResult = await db.collection("userDecks").insertOne({
      userId,
      name: name.trim(),
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      cardCount: cleaned.length,
      pinned: false,
      resumeIndex: 0,
      createdAt: now,
      updatedAt: now,
    });
    const deckId = deckResult.insertedId;

    // ── Create flashcards (words embedded, one document per card) ──
    const flashcards = cleaned.map((c, i) => ({
      userDeckId: deckId,
      userId,
      word: c.word,
      translation: c.translation,
      order: i,
      status: "in_progress" as const,
      createdAt: now,
      updatedAt: now,
    }));
    const inserted = await db.collection("flashcards").insertMany(flashcards);

    return NextResponse.json({
      id: deckId.toString(),
      name: name.trim(),
      createdAt: now,
      resumeIndex: 0,
      cards: cleaned.map((c, i) => ({
        _id: inserted.insertedIds[i].toString(),
        word: c.word,
        translation: c.translation,
        status: "in_progress" as const,
      })),
    });
  } catch (err) {
    console.error("Create deck error:", err);
    return NextResponse.json({ error: "Failed to save deck" }, { status: 500 });
  }
}