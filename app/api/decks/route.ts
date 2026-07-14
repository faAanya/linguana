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

// POST /api/decks
// Body: { name, cards: [{ word, translation }], sourceLang?, targetLang? }
// sourceLang defaults "en", targetLang defaults "unknown".
// When a real targetLang is given, the translation is ALSO stored in the
// global Word.translations map under that language code.
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

    // ── Upsert each word; merge translation into translations map ──
    const wordIds: ObjectId[] = [];

    for (const card of cards) {
      const wordValue = card.word.trim();
      const translationValue = card.translation.trim();

      // Find or create the word
      const existing = await db.collection("words").findOne({
        value: wordValue,
        language: sourceLang,
      });

      if (existing) {
        // Merge the translation into the existing translations map under targetLang.
        // Avoid duplicate entries in the array.
        if (translationValue) {
          const current: string[] = existing.translations?.[targetLang] ?? [];
          if (!current.includes(translationValue)) {
            await db.collection("words").updateOne(
              { _id: existing._id },
              { $set: { [`translations.${targetLang}`]: [...current, translationValue] } }
            );
          }
        }
        wordIds.push(existing._id);
      } else {
        const insertResult = await db.collection("words").insertOne({
          value: wordValue,
          language: sourceLang,
          translations: translationValue ? { [targetLang]: [translationValue] } : {},
          createdAt: now,
        });
        wordIds.push(insertResult.insertedId);
      }
    }

    // ── Create the deck ────────────────────────────────────────────
    const deckResult = await db.collection("userDecks").insertOne({
      userId,
      name: name.trim(),
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      cardCount: cards.length,
      createdAt: now,
      updatedAt: now,
    });
    const deckId = deckResult.insertedId;

    // ── Create flashcards ──────────────────────────────────────────
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

    // ── Mirror cards into the user's personal "My words" collection ──
    // Upsert by (userId, wordId, targetLanguage) so re-saving doesn't
    // create duplicates. Cards with no translation are skipped.
    for (let i = 0; i < cards.length; i++) {
      const wordValue = cards[i].word.trim();
      const translationValue = cards[i].translation.trim();
      if (!wordValue || !translationValue) continue;
      await db.collection("savedWords").updateOne(
        { userId, wordId: wordIds[i], targetLanguage: targetLang },
        {
          $set: {
            word: wordValue,
            translation: translationValue,
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
            updatedAt: now,
          },
          $setOnInsert: { userId, wordId: wordIds[i], createdAt: now },
        },
        { upsert: true }
      );
    }

    // ── Return PracticeDeck shape ──────────────────────────────────
    const insertedCards = await db
      .collection("flashcards")
      .aggregate([
        { $match: { userDeckId: deckId } },
        { $lookup: { from: "words", localField: "wordId", foreignField: "_id", as: "wordDoc" } },
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
        translation: c.customTranslation ?? "",
        status: c.status,
      })),
    });
  } catch (err) {
    console.error("Create deck error:", err);
    return NextResponse.json({ error: "Failed to save deck" }, { status: 500 });
  }
}