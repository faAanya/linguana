import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/app/src/lib/mongodb";
import { getSessionUser, refreshSession } from "@/app/src/lib/jwt";

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

// POST /api/decks — normalized: upsert words, create flashcards with wordId
export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, cards } = await request.json() as {
      name: string;
      cards: { word: string; translation: string }[];
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

    // ── Step 1: upsert each word into the global words collection ──
    // Language is unknown at this point (mixed deck), so we use "unknown".
    // The unique index on {value, language} ensures no duplicates.
    // We store the translation as a map: { unknown: [translation] }
    // so the schema stays consistent with multi-language words later.
    const wordIds: ObjectId[] = [];

    for (const card of cards) {
      const wordValue = card.word.trim();
      const translationValue = card.translation.trim();

      const result = await db.collection("words").findOneAndUpdate(
        { value: wordValue, language: "unknown" },
        {
          $setOnInsert: {
            value: wordValue,
            language: "unknown",
            translations: { unknown: [translationValue] },
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: "after" }
      );

      wordIds.push(result!._id as ObjectId);
    }

    // ── Step 2: create the deck ────────────────────────────────────
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

    // ── Step 3: create flashcards linking deck → word ──────────────
    // customTranslation stores the user's version of the translation.
    // The global Word document is never modified by user edits.
    const flashcards = cards.map((card, i) => ({
      userDeckId: deckId,
      userId,
      wordId: wordIds[i],
      customTranslation: card.translation.trim(),
      status: "learning" as const,
      createdAt: now,
      updatedAt: now,
    }));

    await db.collection("flashcards").insertMany(flashcards);

    // ── Step 4: return PracticeDeck shape for the frontend ─────────
    // Join words back so the frontend gets word + translation strings.
    const insertedCards = await db
      .collection("flashcards")
      .aggregate([
        { $match: { userDeckId: deckId } },
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
      id: deckId.toString(),
      name: name.trim(),
      createdAt: now,
      cards: insertedCards.map((c) => ({
        _id: c._id.toString(),
        word: c.wordDoc.value,
        // Prefer the user's customTranslation, fall back to global word translation
        translation:
          c.customTranslation ??
          c.wordDoc.translations?.unknown?.[0] ??
          "",
        status: c.status,
      })),
    });
  } catch (err: any) {
  console.error("Create deck error:", JSON.stringify(err?.errInfo?.details, null, 2));
  console.error("Create deck error:", err);
  return NextResponse.json({ error: "Failed to save deck" }, { status: 500 });
}
}