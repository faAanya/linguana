/**
 * Sets up all collections, indexes, and validators.
 * Safe to run multiple times — skips existing collections and indexes.
 *
 * Local:
 *   MONGODB_URI=... MONGO_DB_NAME=linguaflash npx ts-node --transpileOnly scripts/initDb.ts
 *
 * Docker:
 *   docker compose exec app npx ts-node --transpileOnly scripts/initDb.ts
 */

import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGO_DB_NAME ?? "linguaflash";

// Skips if collection already exists (code 48 = NamespaceExists)
async function createCollectionSafe(
  db: Db,
  name: string,
  options: Parameters<Db["createCollection"]>[1] = {}
) {
  try {
    await db.createCollection(name, options);
  } catch (err: any) {
    if (err.code === 48) {
      console.log(`  ↩ ${name} already exists, skipping`);
    } else {
      throw err;
    }
  }
}

// Bring an existing collection's validator up to date. Tries collMod first
// (non-destructive). If the DB user lacks the collMod privilege, falls back to
// dropping + recreating the collection — but only when ALLOW_RECREATE=1, since
// that clears data unless preserveData restores it.
async function ensureValidator(
  db: Db,
  name: string,
  validator: Record<string, unknown>,
  opts: { preserveData: boolean }
) {
  try {
    await db.command({ collMod: name, validator, validationLevel: "moderate" });
    console.log(`  ↻ ${name} validator updated (collMod)`);
    return;
  } catch (err: any) {
    if (err.codeName === "NamespaceNotFound") return; // just created with validator
    console.warn(`  ! collMod on ${name} denied: ${err.message}`);
  }

  if (process.env.ALLOW_RECREATE !== "1") {
    console.warn(
      `    → ${name} validator NOT updated. Either grant the DB user collMod, ` +
      `or re-run with ALLOW_RECREATE=1 to recreate it` +
      (opts.preserveData ? " (its data is preserved)." : " (⚠ its documents are cleared).")
    );
    return;
  }

  let backup: Record<string, unknown>[] = [];
  if (opts.preserveData) {
    backup = await db.collection(name).find({}).toArray();
    console.log(`    backing up ${backup.length} ${name} docs`);
  }
  await db.collection(name).drop().catch(() => {});
  await db.createCollection(name, { validator });
  console.log(`  ♻ recreated ${name} with the new validator`);
  if (opts.preserveData && backup.length) {
    try {
      await db.collection(name).insertMany(backup, { ordered: false });
      console.log(`    restored ${backup.length} ${name} docs`);
    } catch (e: any) {
      console.warn(`    some ${name} docs were not restored: ${e.message}`);
    }
  }
}

// Drop an index if it exists (used to remove obsolete unique constraints).
async function dropIndexSafe(db: Db, coll: string, index: string) {
  try {
    await db.collection(coll).dropIndex(index);
    console.log(`  ✂ dropped ${coll}.${index}`);
  } catch {
    /* index doesn't exist — fine */
  }
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  console.log(`Connected to database: ${dbName}\n`);

  // ── users ────────────────────────────────────────────────────
  // Passwordless: no passwordHash. Email is verified via 6-digit code.
  // learningLanguages / nativeLanguages are ISO code arrays (may be empty).
  await createCollectionSafe(db, "users", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["email", "name", "emailVerified", "learningLanguages", "nativeLanguages", "createdAt", "updatedAt"],
        properties: {
          email: { bsonType: "string" },
          name: { bsonType: "string" },
          emailVerified: { bsonType: "bool" },
          learningLanguages: {
            bsonType: "array",
            items: { bsonType: "string" },
          },
          nativeLanguages: {
            bsonType: "array",
            items: { bsonType: "string" },
          },
          createdAt: { bsonType: "date" },
          updatedAt: { bsonType: "date" },
        },
      },
    },
  });
  await db.collection("users").createIndexes([
    { key: { email: 1 }, unique: true, name: "unique_email" },
  ]);
  console.log("✓ users");

  // ── verificationCodes ────────────────────────────────────────
  // Short-lived 6-digit email codes for register/login. The TTL index
  // auto-deletes documents once expiresAt passes (expireAfterSeconds: 0
  // means "delete as soon as the date in expiresAt is reached").
  await createCollectionSafe(db, "verificationCodes", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["email", "codeHash", "mode", "attempts", "expiresAt", "createdAt"],
        properties: {
          email: { bsonType: "string" },
          codeHash: { bsonType: "string" },
          name: { bsonType: ["string", "null"] },
          mode: { enum: ["register", "login"] },
          attempts: { bsonType: "int" },
          expiresAt: { bsonType: "date" },
          createdAt: { bsonType: "date" },
        },
      },
    },
  });
  await db.collection("verificationCodes").createIndexes([
    // One active code per email
    { key: { email: 1 }, unique: true, name: "unique_email_code" },
    // Auto-expire once expiresAt is reached
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "ttl_expires" },
  ]);
  console.log("✓ verificationCodes");

  // (The global "words" dictionary collection was removed — flashcards embed
  //  their own words and "My words" is self-contained. Any existing `words`
  //  collection is simply left unused.)

  // ── deckTemplates ────────────────────────────────────────────
  await createCollectionSafe(db, "deckTemplates", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["name", "sourceLanguage", "targetLanguage", "wordIds", "createdByUserId", "isPublic", "createdAt", "updatedAt"],
        properties: {
          name: { bsonType: "string" },
          sourceLanguage: { bsonType: "string" },
          targetLanguage: { bsonType: "string" },
          wordIds: { bsonType: "array" },
          createdByUserId: { bsonType: "objectId" },
          isPublic: { bsonType: "bool" },
          createdAt: { bsonType: "date" },
          updatedAt: { bsonType: "date" },
        },
      },
    },
  });
  await db.collection("deckTemplates").createIndexes([
    { key: { createdByUserId: 1 }, name: "idx_created_by" },
    { key: { isPublic: 1, createdAt: -1 }, name: "idx_public_decks", partialFilterExpression: { isPublic: true } },
    { key: { sourceLanguage: 1, targetLanguage: 1 }, name: "idx_languages" },
  ]);
  console.log("✓ deckTemplates");

  // ── userDecks ────────────────────────────────────────────────
  await createCollectionSafe(db, "userDecks", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userId", "name", "sourceLanguage", "targetLanguage", "createdAt", "updatedAt"],
        properties: {
          userId: { bsonType: "objectId" },
          name: { bsonType: "string" },
          sourceLanguage: { bsonType: "string" },
          targetLanguage: { bsonType: "string" },
          copiedFromTemplateId: { bsonType: "objectId" },
          pinned: { bsonType: "bool" },
          resumeIndex: { bsonType: "number" },
          cardCount: { bsonType: "number" },
          createdAt: { bsonType: "date" },
          updatedAt: { bsonType: "date" },
        },
      },
    },
  });
  await db.collection("userDecks").createIndexes([
    { key: { userId: 1, createdAt: -1 }, name: "idx_user_decks" },
    { key: { copiedFromTemplateId: 1 }, name: "idx_copied_from", sparse: true },
  ]);
  console.log("✓ userDecks");

  // ── flashcards ───────────────────────────────────────────────
  // Words are embedded directly on the card (no shared dictionary). The same
  // word can appear independently in many decks. Status is in_progress|learnt.
  const flashcardsValidator = {
    $jsonSchema: {
      bsonType: "object",
      required: ["userDeckId", "userId", "word", "translation", "order", "status", "createdAt", "updatedAt"],
      properties: {
        userDeckId: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        word: { bsonType: "string" },
        translation: { bsonType: "string" },
        order: { bsonType: "number" },
        status: { enum: ["in_progress", "learnt"] },
        exampleSentence: {
          bsonType: "object",
          properties: {
            full: { bsonType: "string" },
            masked: { bsonType: "string" },
            answer: { bsonType: "string" },
            fullTranslation: { bsonType: "string" },
          },
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
    },
  };
  await createCollectionSafe(db, "flashcards", { validator: flashcardsValidator });
  await ensureValidator(db, "flashcards", flashcardsValidator, { preserveData: false });
  // Obsolete indexes from the wordId-based schema
  await dropIndexSafe(db, "flashcards", "unique_card_in_deck");
  await dropIndexSafe(db, "flashcards", "idx_word_cards");
  await db.collection("flashcards").createIndexes([
    { key: { userDeckId: 1, order: 1 }, name: "idx_deck_order" },
    { key: { userDeckId: 1, status: 1 }, name: "idx_deck_status" },
  ]);
  console.log("✓ flashcards");

  // ── userWords ────────────────────────────────────────────────
  await createCollectionSafe(db, "userWords", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userId", "wordId", "status", "createdAt", "updatedAt"],
        properties: {
          userId: { bsonType: "objectId" },
          wordId: { bsonType: "objectId" },
          status: { enum: ["new", "learning", "known"] },
          lastReviewedAt: { bsonType: "date" },
          nextReviewAt: { bsonType: "date" },
          createdAt: { bsonType: "date" },
          updatedAt: { bsonType: "date" },
        },
      },
    },
  });
  await db.collection("userWords").createIndexes([
    { key: { userId: 1, wordId: 1 }, unique: true, name: "unique_user_word" },
    { key: { userId: 1, nextReviewAt: 1 }, name: "idx_review_queue", sparse: true },
    { key: { userId: 1, status: 1 }, name: "idx_user_status" },
  ]);
  console.log("✓ userWords");

  // ── savedWords ───────────────────────────────────────────────
  // Personal vocabulary collection (the "My words" list). Fully self-contained
  // and independent of decks/flashcards — no reference to any shared word.
  const savedWordsValidator = {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "word", "translation", "sourceLanguage", "targetLanguage", "createdAt", "updatedAt"],
      properties: {
        userId: { bsonType: "objectId" },
        word: { bsonType: "string" },
        translation: { bsonType: "string" },
        sourceLanguage: { bsonType: "string" },
        targetLanguage: { bsonType: "string" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
    },
  };
  await createCollectionSafe(db, "savedWords", { validator: savedWordsValidator });
  await ensureValidator(db, "savedWords", savedWordsValidator, { preserveData: true });
  await dropIndexSafe(db, "savedWords", "unique_user_saved_word");
  await db.collection("savedWords").createIndexes([
    { key: { userId: 1, createdAt: -1 }, name: "idx_user_saved_words" },
    { key: { userId: 1, word: 1, sourceLanguage: 1, targetLanguage: 1 }, unique: true, name: "unique_user_saved_word" },
  ]);
  console.log("✓ savedWords");

  // ── sourceTexts ──────────────────────────────────────────────
  // Added "prompt" to the type enum for step 5 (prompt-based generation).
  await createCollectionSafe(db, "sourceTexts", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userId", "type", "extractedPairs", "createdAt"],
        properties: {
          userId: { bsonType: "objectId" },
          type: { enum: ["image", "text", "manual", "prompt"] },
          rawText: { bsonType: "string" },
          imageUrl: { bsonType: "string" },
          promptText: { bsonType: "string" },
          extractedPairs: { bsonType: "array" },
          resultingUserDeckId: { bsonType: "objectId" },
          createdAt: { bsonType: "date" },
        },
      },
    },
  });
  await db.collection("sourceTexts").createIndexes([
    { key: { userId: 1, createdAt: -1 }, name: "idx_user_sources" },
    { key: { resultingUserDeckId: 1 }, name: "idx_resulting_deck", sparse: true },
  ]);
  console.log("✓ sourceTexts");

  // ── tests ────────────────────────────────────────────────────
  await createCollectionSafe(db, "tests", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userId", "userDeckId", "questions", "createdAt"],
        properties: {
          userId: { bsonType: "objectId" },
          userDeckId: { bsonType: "objectId" },
          questions: { bsonType: "array" },
          score: { bsonType: "int", minimum: 0, maximum: 100 },
          completedAt: { bsonType: "date" },
          createdAt: { bsonType: "date" },
        },
      },
    },
  });
  await db.collection("tests").createIndexes([
    { key: { userId: 1, createdAt: -1 }, name: "idx_user_tests" },
    { key: { userDeckId: 1 }, name: "idx_deck_tests" },
    { key: { userId: 1, completedAt: -1 }, name: "idx_completed_tests", partialFilterExpression: { completedAt: { $exists: true } } },
  ]);
  console.log("✓ tests");

  console.log("\n✅ All collections and indexes ready.");
  await client.close();
}

main().catch((err) => {
  console.error("❌ Init failed:", err);
  process.exit(1);
});