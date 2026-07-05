import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/app/src/data/mongodb";
import { getSessionUser, refreshSession } from "@/app/src/data/jwt";

async function requireUser() {
  let session = await getSessionUser();
  if (!session) session = await refreshSession();
  return session;
}

// GET /api/decks — list decks belonging to the logged-in user
export async function GET() {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const decks = await db
      .collection("userDecks")
      .find({ userId: new ObjectId(session.userId) })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(
      decks.map((d) => ({
        id: d._id.toString(),
        name: d.name,
        createdAt: d.createdAt,
        cardCount: d.cardCount ?? 0,
      }))
    );
  } catch (err) {
    console.error("Get decks error:", err);
    return NextResponse.json({ error: "Failed to read decks" }, { status: 500 });
  }
}

// POST /api/decks — create a new deck owned by the logged-in user
export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, cards } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Deck name is required" }, { status: 400 });
    }
    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: "No cards provided" }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date();
    const userId = new ObjectId(session.userId);

    const deckResult = await db.collection("userDecks").insertOne({
      userId,
      name: name.trim(),
      sourceLanguage: "unknown",
      targetLanguage: "unknown",
      cardCount: cards.length,
      createdAt: now,
      updatedAt: now,
    });

    const deckId = deckResult.insertedId;

    const flashcards = cards.map((c: { word: string; translation: string }) => ({
      userDeckId: deckId,
      userId,
      word: c.word,
      translation: c.translation,
      status: "learning" as const,
      createdAt: now,
      updatedAt: now,
    }));

    await db.collection("flashcards").insertMany(flashcards);

    const insertedCards = await db
      .collection("flashcards")
      .find({ userDeckId: deckId })
      .toArray();

    return NextResponse.json({
      id: deckId.toString(),
      name: name.trim(),
      createdAt: now,
      cards: insertedCards.map((c) => ({
        _id: c._id.toString(),
        word: c.word,
        translation: c.translation,
        status: c.status,
      })),
    });
  } catch (err) {
    console.error("Create deck error:", err);
    return NextResponse.json({ error: "Failed to save deck" }, { status: 500 });
  }
}