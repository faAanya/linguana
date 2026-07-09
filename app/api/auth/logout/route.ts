import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/app/src/lib/jwt";

export async function POST() {
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
