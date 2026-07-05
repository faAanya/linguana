import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/app/src/data/mongodb";
import { setAuthCookies, toPublicUser } from "@/app/src/data/jwt";
import { AuthTokenPayload } from "@/app/src/models/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email?.trim() || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const user = await db
      .collection("users")
      .findOne({ email: email.toLowerCase().trim() });

    // Use a constant-time comparison path — never reveal whether the
    // email exists vs the password is wrong (prevents user enumeration).
    const passwordHash = user?.passwordHash ?? "$2b$12$invalidhashfortimingattack";
    const isValid = await bcrypt.compare(password, passwordHash);

    if (!user || !isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const payload: AuthTokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
    };

    await setAuthCookies(payload);

    return NextResponse.json({ user: toPublicUser(payload) });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
