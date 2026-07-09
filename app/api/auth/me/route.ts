import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser, refreshSession, toPublicUser } from "@/app/src/lib/jwt";
import { getDb } from "@/app/src/lib/mongodb";

export async function GET() {
  let payload = await getSessionUser();
  if (!payload) payload = await refreshSession();

  if (!payload) {
    return NextResponse.json({ user: null });
  }

  // Fetch language arrays so the client can decide whether onboarding is needed
  try {
    const db = await getDb();
    const user = await db
      .collection("users")
      .findOne(
        { _id: new ObjectId(payload.userId) },
        { projection: { learningLanguages: 1, nativeLanguages: 1 } }
      );

    return NextResponse.json({
      user: {
        ...toPublicUser(payload),
        learningLanguages: user?.learningLanguages ?? [],
        nativeLanguages: user?.nativeLanguages ?? [],
      },
    });
  } catch {
    // If DB read fails, still return the basic session user
    return NextResponse.json({ user: toPublicUser(payload) });
  }
}