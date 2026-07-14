import { ObjectId } from "mongodb";

// ── Word (global dictionary) ──────────────────────────────────
// One document per unique word. Translations into multiple target
// languages are stored as a map so one word can serve many language pairs.
export interface Word {
  _id?: ObjectId;
  value: string;                          // the word itself, e.g. "bonjour"
  language: string;                       // ISO 639-1, e.g. "fr"
  translations: {
    [targetLanguage: string]: string[];   // e.g. { "en": ["hello", "hi"] }
  };
  createdAt: Date;
}

// ── DeckTemplate (public, sharable) ──────────────────────────
export interface DeckTemplate {
  _id?: ObjectId;
  name: string;
  description?: string;
  sourceLanguage: string;                 // ISO 639-1, e.g. "fr"
  targetLanguage: string;                 // ISO 639-1, e.g. "en"
  wordIds: ObjectId[];                    // references to Word collection
  createdByUserId: ObjectId;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── UserDeck (personal copy) ──────────────────────────────────
export interface UserDeck {
  _id?: ObjectId;
  userId: ObjectId;
  name: string;
  description?: string;
  sourceLanguage: string;
  targetLanguage: string;
  copiedFromTemplateId?: ObjectId;        // set when created from a DeckTemplate
  createdAt: Date;
  updatedAt: Date;
}

// ── ExampleSentence (generated once, stored on the flashcard) ─
// Both renderings come from a single generation so the two display
// modes never require regenerating the content.
export interface ExampleSentence {
  full: string;            // natural sentence in the learning language ("I bought an apple yesterday.")
  masked: string;          // target word swapped for its native translation ("I bought an [яблоко] yesterday.")
  answer: string;          // the target word that belongs in the bracket
  fullTranslation: string; // the whole sentence translated into the native language ("Я вчера купил яблоко.")
}

// ── Flashcard (card inside a UserDeck) ───────────────────────
export interface Flashcard {
  _id?: ObjectId;
  userDeckId: ObjectId;
  wordId: ObjectId;                       // reference to global Word
  customTranslation?: string;             // user override, doesn't touch Word
  status: "new" | "learning" | "known";
  exampleSentence?: ExampleSentence;      // generated lazily, then reused
  createdAt: Date;
  updatedAt: Date;
}

// How example sentences are shown during Extended practice.
export type SentenceMode = "word" | "native";

// ── UserWord (cross-deck learning progress) ───────────────────
// Tracks whether a user "knows" a word regardless of which deck it's in.
export interface UserWord {
  _id?: ObjectId;
  userId: ObjectId;
  wordId: ObjectId;
  status: "new" | "learning" | "known";
  lastReviewedAt?: Date;
  nextReviewAt?: Date;                    // for spaced-repetition later
  createdAt: Date;
  updatedAt: Date;
}

// ── SavedWord (personal vocabulary collection) ────────────────
// A word the user saved from the "Add words" (Google-Translate-style)
// screen. Denormalized (word + translation stored inline) so the
// "My words" list renders without a join. Still linked to the global
// Word via wordId so translations feed the shared dictionary.
export interface SavedWord {
  _id?: ObjectId;
  userId: ObjectId;
  wordId: ObjectId;                       // reference to global Word
  word: string;                           // source text, e.g. "hello"
  translation: string;                    // chosen translation, e.g. "hola"
  sourceLanguage: string;                 // ISO 639-1 of `word`
  targetLanguage: string;                 // ISO 639-1 of `translation`
  createdAt: Date;
  updatedAt: Date;
}

// ── SourceText (uploaded text/image for AI extraction) ────────
export type SourceTextType = "image" | "text" | "manual";

export interface SourceText {
  _id?: ObjectId;
  userId: ObjectId;
  type: SourceTextType;
  rawText?: string;                       // extracted or pasted text
  imageUrl?: string;                      // stored image path/url if type=image
  extractedPairs: {
    word: string;
    translation: string;
  }[];
  resultingUserDeckId?: ObjectId;         // set after user confirms + saves
  createdAt: Date;
}

// ── Test (AI-generated quiz linked to a UserDeck) ─────────────
export type QuestionType =
  | "multiple_choice"
  | "translation"
  | "fill_in_the_blank";

export interface TestQuestion {
  flashcardId: ObjectId;
  wordId: ObjectId;
  questionType: QuestionType;
  question: string;
  options?: string[];                     // for multiple_choice
  correctAnswer: string;
  userAnswer?: string;
  isCorrect?: boolean;
}

export interface Test {
  _id?: ObjectId;
  userId: ObjectId;
  userDeckId: ObjectId;
  questions: TestQuestion[];
  score?: number;                         // 0-100
  completedAt?: Date;
  createdAt: Date;
}

// ── Frontend-only types (UI components, not stored directly) ──
// These are the lean shapes returned by API routes and consumed by
// React components — no ObjectIds, no DB-only fields.

export interface PracticeCard {
  _id?: string;
  word: string;
  translation: string;
  status: "new" | "learning" | "known";
}

export interface PracticeDeck {
  id: string;
  name: string;
  createdAt: string;
  cards: PracticeCard[];
}