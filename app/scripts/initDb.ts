/**
 * Run once to set up all collections, indexes, and validators.
 * Or inside docker:
 *   docker compose exec app npx ts-node scripts/initDb.ts
 */

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGO_DB_NAME ?? "linguana";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  console.log(`Connected to database: ${dbName}`);

  // ── users ────────────────────────────────────────────────────
  await db.createCollection("users", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["email", "name", "createdAt", "updatedAt"],
        properties: {
          email: { bsonType: "string" },
          name: { bsonType: "string" },
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

  // ── words ────────────────────────────────────────────────────
  await db.createCollection("words", {
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
    // Fast lookup of a specific word in a language
    { key: { value: 1, language: 1 }, unique: true, name: "unique_word_language" },
    // Browse/search words by language
    { key: { language: 1 }, name: "idx_language" },
  ]);
  console.log("✓ words");

  // ── deckTemplates ────────────────────────────────────────────
  await db.createCollection("deckTemplates", {
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
    // Only index public templates (partial index, much smaller)
    { key: { isPublic: 1, createdAt: -1 }, name: "idx_public_decks", partialFilterExpression: { isPublic: true } },
    { key: { sourceLanguage: 1, targetLanguage: 1 }, name: "idx_languages" },
  ]);
  console.log("✓ deckTemplates");

  // ── userDecks ────────────────────────────────────────────────
  await db.createCollection("userDecks", {
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
    // All decks for a user, newest first
    { key: { userId: 1, createdAt: -1 }, name: "idx_user_decks" },
    // Trace which template a deck was copied from
    { key: { copiedFromTemplateId: 1 }, name: "idx_copied_from", sparse: true },
  ]);
  console.log("✓ userDecks");

  // ── flashcards ───────────────────────────────────────────────
  await db.createCollection("flashcards", {
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
    // All cards in a deck
    { key: { userDeckId: 1 }, name: "idx_deck_cards" },
    // All cards for a specific word across all decks
    { key: { wordId: 1 }, name: "idx_word_cards" },
    // Filter by status within a deck (e.g. "show only learning cards")
    { key: { userDeckId: 1, status: 1 }, name: "idx_deck_status" },
    // A word should appear only once per deck
    { key: { userDeckId: 1, wordId: 1 }, unique: true, name: "unique_card_in_deck" },
  ]);
  console.log("✓ flashcards");

  // ── userWords ────────────────────────────────────────────────
  await db.createCollection("userWords", {
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
    // A user tracks each word only once (cross-deck)
    { key: { userId: 1, wordId: 1 }, unique: true, name: "unique_user_word" },
    // Words due for spaced-repetition review
    { key: { userId: 1, nextReviewAt: 1 }, name: "idx_review_queue", sparse: true },
    // All known words for a user
    { key: { userId: 1, status: 1 }, name: "idx_user_status" },
  ]);
  console.log("✓ userWords");

  // ── sourceTexts ──────────────────────────────────────────────
  await db.createCollection("sourceTexts", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userId", "type", "extractedPairs", "createdAt"],
        properties: {
          userId: { bsonType: "objectId" },
          type: { enum: ["image", "text", "manual"] },
          rawText: { bsonType: "string" },
          imageUrl: { bsonType: "string" },
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
  await db.createCollection("tests", {
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
    // Only index completed tests (partial index)
    { key: { userId: 1, completedAt: -1 }, name: "idx_completed_tests", partialFilterExpression: { completedAt: { $exists: true } } },
  ]);
  console.log("✓ tests");

  console.log("\n✅ All collections and indexes created successfully.");
  await client.close();
}

main().catch((err) => {
  console.error("❌ Init failed:", err);
  process.exit(1);
});