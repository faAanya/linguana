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

    // Always respond the same way whether or not the account exists,
    // to avoid revealing which emails are registered. Only send if it exists.
    if (user) {
      const code = generateCode();
      await storeCode(normalizedEmail, code, { mode: "login" });
      await sendVerificationCode(normalizedEmail, code);
    }

    return NextResponse.json({
      ok: true,
      message: "If that email is registered, a code has been sent",
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Failed to send code" }, { status: 500 });
  }
}