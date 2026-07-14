import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/src/lib/mongodb";
import { generateCode, storeCode } from "@/app/src/lib/verificationCode";
import { sendVerificationCode } from "@/app/src/lib/email";

// POST /api/auth/login — { email }
// Sends a 6-digit code to an EXISTING user's email.
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const db = await getDb();

    const user = await db.collection("users").findOne({ email: normalizedEmail });

    // Tell the client whether the account exists so the UI can steer an
    // unregistered visitor to sign up. Only send a code if it exists.
    if (user) {
      const code = generateCode();
      await storeCode(normalizedEmail, code, { mode: "login" });
      await sendVerificationCode(normalizedEmail, code);
    }

    return NextResponse.json({
      ok: true,
      exists: !!user,
      message: user
        ? "A login code has been sent"
        : "No account found for that email",
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Failed to send code" }, { status: 500 });
  }
}