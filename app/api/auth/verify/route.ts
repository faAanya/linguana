import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/src/lib/mongodb";
import { verifyCode } from "@/app/src/lib/verificationCode";
import { setAuthCookies, toPublicUser } from "@/app/src/lib/jwt";
import { AuthTokenPayload } from "@/app/src/models/auth";

// POST /api/auth/verify — { email, code }
// Validates the code. For registration, creates the user. Then sets cookies.
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email?.trim() || !code?.trim()) {
      return NextResponse.json(
        { error: "Email and code are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const result = await verifyCode(normalizedEmail, code.trim());

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date();

    let user = await db.collection("users").findOne({ email: normalizedEmail });

    // Registration: user doesn't exist yet, create them
    if (!user) {
      if (result.mode !== "register" || !result.name) {
        return NextResponse.json(
          { error: "Account not found. Please register first." },
          { status: 404 }
        );
      }

      const insertResult = await db.collection("users").insertOne({
        email: normalizedEmail,
        name: result.name,
        emailVerified: true,
        learningLanguages: [],   // step 2
        nativeLanguages: [],     // step 3
        createdAt: now,
        updatedAt: now,
      });

      user = await db.collection("users").findOne({ _id: insertResult.insertedId });
    }

    const payload: AuthTokenPayload = {
      userId: user!._id.toString(),
      email: user!.email,
      name: user!.name,
    };

    await setAuthCookies(payload);

    return NextResponse.json({ user: toPublicUser(payload) });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}