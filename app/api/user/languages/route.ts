import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/app/src/lib/mongodb";
import { getSessionUser, refreshSession } from "@/app/src/lib/jwt";
import { LANGUAGE_MAP } from "@/app/src/models/languages";

async function requireUser() {
  let session = await getSessionUser();
  if (!session) session = await refreshSession();
  return session;
}

// Validate that every code is in our curated list
function validCodes(codes: unknown): codes is string[] {
  return (
    Array.isArray(codes) &&
    codes.every((c) => typeof c === "string" && c in LANGUAGE_MAP)
  );
}

// GET /api/user/languages — return current user's language arrays
export async function GET() {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const user = await db
      .collection("users")
      .findOne(
        { _id: new ObjectId(session.userId) },
        { projection: { learningLanguages: 1, nativeLanguages: 1 } }
      );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      learningLanguages: user.learningLanguages ?? [],
      nativeLanguages: user.nativeLanguages ?? [],
    });
  } catch (err) {
    console.error("Get languages error:", err);
    return NextResponse.json({ error: "Failed to read languages" }, { status: 500 });
  }
}

// PUT /api/user/languages — { learningLanguages, nativeLanguages }
export async function PUT(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { learningLanguages, nativeLanguages } = await request.json();

    if (!validCodes(learningLanguages) || !validCodes(nativeLanguages)) {
      return NextResponse.json(
        { error: "Invalid language codes" },
        { status: 400 }
      );
    }

    if (learningLanguages.length === 0 || nativeLanguages.length === 0) {
      return NextResponse.json(
        { error: "Pick at least one language for each" },
        { status: 400 }
      );
    }

    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: new ObjectId(session.userId) },
      {
        $set: {
          learningLanguages: [...new Set(learningLanguages)],
          nativeLanguages: [...new Set(nativeLanguages)],
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Update languages error:", err);
    return NextResponse.json({ error: "Failed to update languages" }, { status: 500 });
  }
}