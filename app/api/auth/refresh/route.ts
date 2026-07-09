import { NextResponse } from "next/server";
import { refreshSession, toPublicUser } from "@/app/src/lib/jwt";

export async function POST() {
  const payload = await refreshSession();

  if (!payload) {
    return NextResponse.json(
      { error: "Session expired, please log in again" },
      { status: 401 }
    );
  }

  return NextResponse.json({ user: toPublicUser(payload) });
}
