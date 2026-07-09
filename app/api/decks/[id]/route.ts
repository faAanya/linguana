import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/app/src/lib/mongodb";
import { getSessionUser, refreshSession } from "@/app/src/lib/jwt";

async function requireUser() {
  let session = await getSessionUser();
  if (!session) session = await refreshSession();
  return session;
}

// GET /api/decks/:id — get one deck with cards joined from words collection
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const deckId = new ObjectId(id);
    const userId = new ObjectId(session.userId);

    const deck = await db
      .collection("userDecks")
      .findOne({ _id: deckId, userId });

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    // Join flashcards → words to get word text back
    const cards = await db
      .collection("flashcards")
      .aggregate([
        { $match: { userDeckId: deckId } },
        { $sort: { createdAt: 1 } },
        {
          $lookup: {
            from: "words",
            localField: "wordId",
            foreignField: "_id",
            as: "wordDoc",
          },
        },
        { $unwind: "$wordDoc" },
      ])
      .toArray();

    return NextResponse.json({
      id: deck._id.toString(),
      name: deck.name,
      createdAt: deck.createdAt,
      cards: cards.map((c) => ({
        _id: c._id.toString(),
        word: c.wordDoc.value,
        translation:
          c.customTranslation ??
          c.wordDoc.translations?.unknown?.[0] ??
          "",
        status: c.status,
      })),
    });
  } catch (err) {
    console.error("Get deck error:", err);
    return NextResponse.json({ error: "Failed to read deck" }, { status: 500 });
  }
}

// PATCH /api/decks/:id — update one card's status (ownership checked)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { cardIndex, status } = await request.json();

    if (typeof cardIndex !== "number" || !["learning", "known"].includes(status)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = await getDb();
    const deckId = new ObjectId(id);
    const userId = new ObjectId(session.userId);

    const deck = await db
      .collection("userDecks")
      .findOne({ _id: deckId, userId });

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const cards = await db
      .collection("flashcards")
      .find({ userDeckId: deckId })
      .sort({ createdAt: 1 })
      .toArray();

    if (!cards[cardIndex]) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    await db.collection("flashcards").updateOne(
      { _id: cards[cardIndex]._id },
      { $set: { status, updatedAt: new Date() } }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Update card error:", err);
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
  }
}

// DELETE /api/decks/:id — delete deck and its flashcards (ownership checked)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const deckId = new ObjectId(id);
    const userId = new ObjectId(session.userId);

    const deck = await db
      .collection("userDecks")
      .findOne({ _id: deckId, userId });

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    // Note: we only delete the flashcards and the deck.
    // Word documents in the global words collection are never deleted
    // since they may be referenced by other users' decks.
    await db.collection("flashcards").deleteMany({ userDeckId: deckId });
    await db.collection("userDecks").deleteOne({ _id: deckId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete deck error:", err);
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 });
  }
}