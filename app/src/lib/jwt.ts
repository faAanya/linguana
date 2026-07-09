import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { AuthTokenPayload, PublicUser } from "@/app/src/models/auth";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

const ACCESS_TOKEN_TTL = "1h";
const REFRESH_TOKEN_TTL = "30d";
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

export function signAccessToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AuthTokenPayload;
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as AuthTokenPayload;
}

export async function setAuthCookies(payload: AuthTokenPayload) {
  const cookieStore = await cookies();
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  cookieStore.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60,                    // 1h in seconds
    path: "/",
  });

  cookieStore.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,         // 30 days in seconds
    path: "/",
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

// Reads and verifies the access token from cookies.
// Returns null if missing or invalid (caller decides how to respond).
export async function getSessionUser(): Promise<AuthTokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!token) return null;
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

// Attempts to refresh the session using the refresh token cookie.
// Returns the new payload if successful, null otherwise.
export async function refreshSession(): Promise<AuthTokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(REFRESH_COOKIE)?.value;
    if (!token) return null;
    const payload = verifyRefreshToken(token);
    const newPayload: AuthTokenPayload = {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
    };
    await setAuthCookies(newPayload);
    return newPayload;
  } catch {
    return null;
  }
}

export function toPublicUser(payload: AuthTokenPayload): PublicUser {
  return { id: payload.userId, email: payload.email, name: payload.name };
}
