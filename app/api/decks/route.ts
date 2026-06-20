import { NextRequest, NextResponse } from "next/server";
import { readDecks, createDeck } from "@/app/src/data/DeckStore";

// GET /api/decks — list all decks (summary only, no full card arrays)
export async function GET() {
  try {
    const decks = await readDecks();
    const summaries = decks.map(({ cards, ...rest }) => ({
      ...rest,
      cardCount: cards.length,
    }));
    return NextResponse.json(summaries);
  } catch (err) {
    console.error("Get decks error:", err);
    return NextResponse.json({ error: "Failed to read decks" }, { status: 500 });
  }
}

// POST /api/decks — create a new deck
export async function POST(request: NextRequest) {
  try {
    const { name, cards } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Deck name is required" }, { status: 400 });
    }
    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: "No cards provided" }, { status: 400 });
    }

    const deck = await createDeck(name, cards);
    return NextResponse.json(deck);
  } catch (err) {
    console.error("Create deck error:", err);
    return NextResponse.json({ error: "Failed to save deck" }, { status: 500 });
  }
}