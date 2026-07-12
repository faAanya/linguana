import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/app/src/lib/mongodb";
import { getSessionUser, refreshSession } from "@/app/src/lib/jwt";

async function requireUser() {
  let session = await getSessionUser();
  if (!session) session = await refreshSession();
  return session;
}

// Upsert a word and return its _id. Merges translation into the
// translations map under the deck's target language.
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

// ── GET: deck + cards (joined from words) ──────────────────────
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
      .aggregate([
        { $match: { userDeckId: deckId } },
        { $sort: { createdAt: 1 } },
        { $lookup: { from: "words", localField: "wordId", foreignField: "_id", as: "wordDoc" } },
        { $unwind: "$wordDoc" },
      ])
      .toArray();

    return NextResponse.json({
      id: deck._id.toString(),
      name: deck.name,
      sourceLanguage: deck.sourceLanguage ?? "unknown",
      targetLanguage: deck.targetLanguage ?? "unknown",
      createdAt: deck.createdAt,
      cards: cards.map((c) => ({
        _id: c._id.toString(),
        word: c.wordDoc.value,
        translation: c.customTranslation ?? "",
        status: c.status,
      })),
    });
  } catch (err) {
    console.error("Get deck error:", err);
    return NextResponse.json({ error: "Failed to read deck" }, { status: 500 });
  }
}

// ── PATCH: update one card's status by index (used during practice) ──
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { cardIndex, status } = await request.json();

    if (typeof cardIndex !== "number" || !["learning", "known"].includes(status)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = await getDb();
    const deckId = new ObjectId(id);
    const userId = new ObjectId(session.userId);

    const deck = await db.collection("userDecks").findOne({ _id: deckId, userId });
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

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

// ── PUT: edit deck (rename + full card sync) ───────────────────
// Body: { name, cards: [{ _id?, word, translation }] }
// Existing cards keep their _id (status preserved). Missing ones are deleted.
// New cards (no _id) are created. Words are upserted.
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

    const sourceLang = deck.sourceLanguage ?? "unknown";
    const targetLang = deck.targetLanguage ?? "unknown";

    // Rename the deck
    await db.collection("userDecks").updateOne(
      { _id: deckId },
      { $set: { name: name.trim(), updatedAt: now } }
    );

    // Existing card ids in DB
    const existingCards = await db
      .collection("flashcards")
      .find({ userDeckId: deckId })
      .toArray();
    const existingIds = new Set(existingCards.map((c) => c._id.toString()));

    // Ids the client kept
    const keptIds = new Set(
      cards.filter((c) => c._id).map((c) => c._id as string)
    );

    // 1) Delete cards removed by the user
    const toDelete = [...existingIds].filter((eid) => !keptIds.has(eid));
    if (toDelete.length > 0) {
      await db.collection("flashcards").deleteMany({
        _id: { $in: toDelete.map((tid) => new ObjectId(tid)) },
      });
    }

    // 2) Update existing + insert new
    for (const card of cards) {
      if (!card.word.trim()) continue;
      const wordId = await upsertWord(db, card.word, card.translation, sourceLang, targetLang, now);

      if (card._id && existingIds.has(card._id)) {
        // Update existing flashcard's word ref + custom translation
        await db.collection("flashcards").updateOne(
          { _id: new ObjectId(card._id) },
          {
            $set: {
              wordId,
              customTranslation: card.translation.trim(),
              updatedAt: now,
            },
          }
        );
      } else {
        // New card
        await db.collection("flashcards").insertOne({
          userDeckId: deckId,
          userId,
          wordId,
          customTranslation: card.translation.trim(),
          status: "learning",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Update card count
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