import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/app/src/data/DeckStore";

// GET /api/decks/:id — get one deck with all its flashcards
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const deckId = new ObjectId(id);

    const deck = await db.collection("userDecks").findOne({ _id: deckId });
    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const cards = await db
      .collection("flashcards")
      .find({ userDeckId: deckId })
      .toArray();

    return NextResponse.json({
      id: deck._id.toString(),
      name: deck.name,
      createdAt: deck.createdAt,
      cards: cards.map((c) => ({
        _id: c._id.toString(),
        word: c.word,
        translation: c.translation,
        status: c.status,
      })),
    });
  } catch (err) {
    console.error("Get deck error:", err);
    return NextResponse.json({ error: "Failed to read deck" }, { status: 500 });
  }
}

// PATCH /api/decks/:id — update one card's status by its index
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { cardIndex, status } = await request.json();

    if (typeof cardIndex !== "number" || !["learning", "known"].includes(status)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = await getDb();
    const deckId = new ObjectId(id);

    // Fetch cards in stable insertion order, then update the one at cardIndex
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

// DELETE /api/decks/:id — delete deck and all its flashcards
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const deckId = new ObjectId(id);

    await db.collection("flashcards").deleteMany({ userDeckId: deckId });
    await db.collection("userDecks").deleteOne({ _id: deckId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete deck error:", err);
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 });
  }
}