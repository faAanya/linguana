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

  // ── words ────────────────────────────────────────────────────
  await createCollectionSafe(db, "words", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["value", "language", "translations", "createdAt"],
        properties: {
          value: { bsonType: "string" },
          language: { bsonType: "string" },
          translations: { bsonType: "object" },
          createdAt: { bsonType: "date" },
        },
      },
    },
  });
  await db.collection("words").createIndexes([
    { key: { value: 1, language: 1 }, unique: true, name: "unique_word_language" },
    { key: { language: 1 }, name: "idx_language" },
  ]);
  console.log("✓ words");

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
  await createCollectionSafe(db, "flashcards", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userDeckId", "wordId", "status", "createdAt", "updatedAt"],
        properties: {
          userDeckId: { bsonType: "objectId" },
          wordId: { bsonType: "objectId" },
          customTranslation: { bsonType: "string" },
          status: { enum: ["new", "learning", "known"] },
          createdAt: { bsonType: "date" },
          updatedAt: { bsonType: "date" },
        },
      },
    },
  });
  await db.collection("flashcards").createIndexes([
    { key: { userDeckId: 1 }, name: "idx_deck_cards" },
    { key: { wordId: 1 }, name: "idx_word_cards" },
    { key: { userDeckId: 1, status: 1 }, name: "idx_deck_status" },
    { key: { userDeckId: 1, wordId: 1 }, unique: true, name: "unique_card_in_deck" },
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