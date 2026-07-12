import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/app/src/lib/mongodb";
import { getSessionUser, refreshSession } from "@/app/src/lib/jwt";

async function requireUser() {
  let session = await getSessionUser();
  if (!session) session = await refreshSession();
  return session;
}

// PATCH /api/words/[id] — edit a saved word's text/translation.
// Body: { word?, translation? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { word, translation } = (await request.json()) as {
      word?: string;
      translation?: string;
    };

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof word === "string") {
      if (!word.trim()) {
        return NextResponse.json({ error: "Word can't be empty" }, { status: 400 });
      }
      update.word = word.trim();
    }
    if (typeof translation === "string") {
      if (!translation.trim()) {
        return NextResponse.json({ error: "Translation can't be empty" }, { status: 400 });
      }
      update.translation = translation.trim();
    }

    const db = await getDb();
    const result = await db.collection("savedWords").updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(session.userId) },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Edit word error:", err);
    return NextResponse.json({ error: "Failed to update word" }, { status: 500 });
  }
}

// DELETE /api/words/[id] — remove a word from the user's collection.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const db = await getDb();
    const result = await db.collection("savedWords").deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.userId),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete word error:", err);
    return NextResponse.json({ error: "Failed to delete word" }, { status: 500 });
  }
}
