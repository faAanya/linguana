import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/app/src/lib/mongodb";
import { getSessionUser, refreshSession } from "@/app/src/lib/jwt";
import { generateSentence } from "@/app/src/lib/sentences";

async function requireUser() {
  let session = await getSessionUser();
  if (!session) session = await refreshSession();
  return session;
}

// POST /api/decks/[id]/sentences
// Ensures every flashcard in the deck has a stored example sentence,
// generating (and persisting) only the ones that are missing. Returns the
// sentences in the deck's card order so both display modes can be rendered
// on the client without any regeneration.
export async function POST(
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

    const sentences: {
      cardId: string;
      word: string;
      translation: string;
      full: string;
      masked: string;
      answer: string;
      fullTranslation: string;
    }[] = [];

    for (const c of cards) {
      const word: string = c.wordDoc.value;
      const translation: string = c.customTranslation ?? "";

      let example = c.exampleSentence;

      // Generate + persist only when it's missing or predates the
      // full-sentence translation (generate once, then reuse).
      if (!example?.full || !example?.masked || !example?.fullTranslation) {
        try {
          example = await generateSentence(word, translation);
          await db.collection("flashcards").updateOne(
            { _id: c._id },
            { $set: { exampleSentence: example, updatedAt: new Date() } }
          );
        } catch (err) {
          console.error("Sentence generation failed for", word, err);
          continue; // skip this card; others still work
        }
      }

      sentences.push({
        cardId: c._id.toString(),
        word,
        translation,
        full: example.full,
        masked: example.masked,
        answer: example.answer ?? word,
        fullTranslation: example.fullTranslation ?? "",
      });
    }

    return NextResponse.json({ sentences });
  } catch (err) {
    console.error("Deck sentences error:", err);
    return NextResponse.json({ error: "Failed to prepare sentences" }, { status: 500 });
  }
}
