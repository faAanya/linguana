import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/src/lib/mongodb";
import { generateCode, storeCode } from "@/app/src/lib/verificationCode";
import { sendVerificationCode } from "@/app/src/lib/email";

// POST /api/auth/register — { name, email }
// Sends a 6-digit code. User is NOT created yet; that happens on verify.
export async function POST(request: NextRequest) {
  try {
    const { name, email } = await request.json();

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const db = await getDb();

    // Block if an account already exists
    const existing = await db.collection("users").findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try logging in." },
        { status: 409 }
      );
    }

    const code = generateCode();
    await storeCode(normalizedEmail, code, { name: name.trim(), mode: "register" });
    await sendVerificationCode(normalizedEmail, code);

    return NextResponse.json({ ok: true, message: "Verification code sent" });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Failed to send code" }, { status: 500 });
  }
}