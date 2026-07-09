import bcrypt from "bcryptjs";
import { getDb } from "./mongodb";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

// Generates a 6-digit numeric code as a string (leading zeros preserved)
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Stores a hashed code for an email in the verificationCodes collection.
// Any previous code for the same email is overwritten (one active code at a time).
export async function storeCode(
  email: string,
  code: string,
  meta: { name?: string; mode: "register" | "login" }
) {
  const db = await getDb();
  const codeHash = await bcrypt.hash(code, 10);

  await db.collection("verificationCodes").updateOne(
    { email: email.toLowerCase() },
    {
      $set: {
        email: email.toLowerCase(),
        codeHash,
        name: meta.name ?? null,
        mode: meta.mode,
        attempts: 0,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

// Verifies a submitted code. Returns { ok, reason?, name?, mode? }.
export async function verifyCode(
  email: string,
  code: string
): Promise<{ ok: boolean; reason?: string; name?: string; mode?: "register" | "login" }> {
  const db = await getDb();
  const record = await db
    .collection("verificationCodes")
    .findOne({ email: email.toLowerCase() });

  if (!record) {
    return { ok: false, reason: "No code found. Please request a new one." };
  }

  if (new Date() > new Date(record.expiresAt)) {
    await db.collection("verificationCodes").deleteOne({ email: email.toLowerCase() });
    return { ok: false, reason: "Code expired. Please request a new one." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await db.collection("verificationCodes").deleteOne({ email: email.toLowerCase() });
    return { ok: false, reason: "Too many attempts. Please request a new one." };
  }

  const isValid = await bcrypt.compare(code, record.codeHash);

  if (!isValid) {
    await db.collection("verificationCodes").updateOne(
      { email: email.toLowerCase() },
      { $inc: { attempts: 1 } }
    );
    return { ok: false, reason: "Incorrect code." };
  }

  // Success — consume the code so it can't be reused
  await db.collection("verificationCodes").deleteOne({ email: email.toLowerCase() });
  return { ok: true, name: record.name ?? undefined, mode: record.mode };
}