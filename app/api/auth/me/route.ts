import { NextResponse } from "next/server";
import { getSessionUser, refreshSession, toPublicUser } from "@/app/src/data/jwt";

export async function GET() {
  // Try access token first
  let payload = await getSessionUser();

  // If expired, try to refresh silently
  if (!payload) {
    payload = await refreshSession();
  }

  if (!payload) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: toPublicUser(payload) });
}
