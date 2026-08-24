import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/app/src/lib/mongodb";
import { getSessionUser, refreshSession } from "@/app/src/lib/jwt";

async function requireUser() {
  let session = await getSessionUser();
  if (!session) session = await refreshSession();
  return session;
}

// ── GET: deck + its embedded cards (ordered) ───────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const db = await getDb();
    const deckId = new ObjectId(id);
    const userId = new ObjectId(session.userId);

    const deck = await db.collection("userDecks").findOne({ _id: deckId, userId });
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

    const cards = await db
      .collection("flashcards")
      .find({ userDeckId: deckId })
      .sort({ order: 1, createdAt: 1 })
      .toArray();

    return NextResponse.json({
      id: deck._id.toString(),
      name: deck.name,
      sourceLanguage: deck.sourceLanguage ?? "unknown",
      targetLanguage: deck.targetLanguage ?? "unknown",
      createdAt: deck.createdAt,
      resumeIndex: deck.resumeIndex ?? 0,
      cards: cards.map((c) => ({
        _id: c._id.toString(),
        word: c.word ?? "",
        translation: c.translation ?? "",
        status: c.status === "learnt" ? "learnt" : "in_progress",
      })),
    });
  } catch (err) {
    console.error("Get deck error:", err);
    return NextResponse.json({ error: "Failed to read deck" }, { status: 500 });
  }
}

// ── PATCH: pin, resume position, a card's status, or revive all ──
// Body is one of:
//   { pinned: boolean }
//   { resumeIndex: number }
//   { cardId: string, status: "in_progress" | "learnt" }
//   { revive: true }   → reset every card to in_progress + resumeIndex 0
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const db = await getDb();
    const deckId = new ObjectId(id);
    const userId = new ObjectId(session.userId);
    const now = new Date();

    const deck = await db.collection("userDecks").findOne({ _id: deckId, userId });
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

    // Pin / unpin
    if (typeof body.pinned === "boolean") {
      await db.collection("userDecks").updateOne(
        { _id: deckId },
        { $set: { pinned: body.pinned, updatedAt: now } }
      );
      return NextResponse.json({ ok: true, pinned: body.pinned });
    }

    // Revive: every card back to in_progress, start the deck over
    if (body.revive === true) {
      await db.collection("flashcards").updateMany(
        { userDeckId: deckId },
        { $set: { status: "in_progress", updatedAt: now } }
      );
      await db.collection("userDecks").updateOne(
        { _id: deckId },
        { $set: { resumeIndex: 0, updatedAt: now } }
      );
      return NextResponse.json({ ok: true });
    }

    // Save the resume position
    if (typeof body.resumeIndex === "number") {
      await db.collection("userDecks").updateOne(
        { _id: deckId },
        { $set: { resumeIndex: Math.max(0, Math.floor(body.resumeIndex)), updatedAt: now } }
      );
      return NextResponse.json({ ok: true });
    }

    // Update one card's status
    if (typeof body.cardId === "string" && ["in_progress", "learnt"].includes(body.status)) {
      const result = await db.collection("flashcards").updateOne(
        { _id: new ObjectId(body.cardId), userDeckId: deckId },
        { $set: { status: body.status, updatedAt: now } }
      );
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  } catch (err) {
    console.error("Update deck error:", err);
    return NextResponse.json({ error: "Failed to update deck" }, { status: 500 });
  }
}

// ── PUT: edit deck (rename + full card sync) ───────────────────
// Body: { name, cards: [{ _id?, word, translation }] }
// Existing cards keep their _id (status preserved). Missing ones are deleted.
// New cards (no _id) are created as in_progress. Order follows the array.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { name, cards } = await request.json() as {
      name: string;
      cards: { _id?: string; word: string; translation: string }[];
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Deck name is required" }, { status: 400 });
    }
    if (!Array.isArray(cards)) {
      return NextResponse.json({ error: "Cards must be an array" }, { status: 400 });
    }

    const db = await getDb();
    const deckId = new ObjectId(id);
    const userId = new ObjectId(session.userId);
    const now = new Date();

    const deck = await db.collection("userDecks").findOne({ _id: deckId, userId });
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

    await db.collection("userDecks").updateOne(
      { _id: deckId },
      { $set: { name: name.trim(), updatedAt: now } }
    );

    const existingCards = await db
      .collection("flashcards")
      .find({ userDeckId: deckId })
      .toArray();
    const existingIds = new Set(existingCards.map((c) => c._id.toString()));

    const kept = cards.filter((c) => c.word.trim());
    const keptIds = new Set(kept.filter((c) => c._id).map((c) => c._id as string));

    // 1) Delete cards the user removed
    const toDelete = [...existingIds].filter((eid) => !keptIds.has(eid));
    if (toDelete.length > 0) {
      await db.collection("flashcards").deleteMany({
        _id: { $in: toDelete.map((tid) => new ObjectId(tid)) },
      });
    }

    // 2) Update existing + insert new, assigning order by array position
    for (let i = 0; i < kept.length; i++) {
      const card = kept[i];
      const word = card.word.trim();
      const translation = card.translation.trim();

      if (card._id && existingIds.has(card._id)) {
        await db.collection("flashcards").updateOne(
          { _id: new ObjectId(card._id) },
          { $set: { word, translation, order: i, updatedAt: now } }
        );
      } else {
        await db.collection("flashcards").insertOne({
          userDeckId: deckId,
          userId,
          word,
          translation,
          order: i,
          status: "in_progress",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const newCount = await db.collection("flashcards").countDocuments({ userDeckId: deckId });
    await db.collection("userDecks").updateOne(
      { _id: deckId },
      { $set: { cardCount: newCount } }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Edit deck error:", err);
    return NextResponse.json({ error: "Failed to save deck" }, { status: 500 });
  }
}

// ── DELETE: remove deck + its flashcards ───────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const db = await getDb();
    const deckId = new ObjectId(id);
    const userId = new ObjectId(session.userId);

    const deck = await db.collection("userDecks").findOne({ _id: deckId, userId });
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

    await db.collection("flashcards").deleteMany({ userDeckId: deckId });
    await db.collection("userDecks").deleteOne({ _id: deckId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete deck error:", err);
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 });
  }
}
