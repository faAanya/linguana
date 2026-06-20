import { NextRequest, NextResponse } from "next/server";
import { getDeck, updateCardStatus, deleteDeck } from "@/app/src/data/DeckStore";

// GET /api/decks/:id — get one deck with full cards
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deck = await getDeck(id);
    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }
    return NextResponse.json(deck);
  } catch (err) {
    console.error("Get deck error:", err);
    return NextResponse.json({ error: "Failed to read deck" }, { status: 500 });
  }
}

// PATCH /api/decks/:id — update one card's status
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

    const deck = await updateCardStatus(id, cardIndex, status);
    if (!deck) {
      return NextResponse.json({ error: "Deck or card not found" }, { status: 404 });
    }

    return NextResponse.json(deck);
  } catch (err) {
    console.error("Update card error:", err);
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
  }
}

// DELETE /api/decks/:id — delete a deck
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteDeck(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete deck error:", err);
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 });
  }
}