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
  pinned?: boolean;
  // Where General practice should resume: an index into the deck's ordered
  // cards. Reaches cardCount when a pass is complete (next pass starts over).
  resumeIndex?: number;
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

// Progress of a single flashcard. New cards start "in_progress"; a card the
// user marks as known during practice becomes "learnt".
export type CardStatus = "in_progress" | "learnt";

// ── Flashcard (card inside a UserDeck) ───────────────────────
// Words are embedded directly on the card and belong to this deck only —
// they are NOT shared with other decks or with the "My words" collection, so
// the same word can appear independently in many decks.
export interface Flashcard {
  _id?: ObjectId;
  userDeckId: ObjectId;
  userId: ObjectId;
  word: string;                           // the term being learned
  translation: string;                    // its translation
  order: number;                          // position within the deck
  status: CardStatus;
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
// A word the user saved from the "Add words" screen. Fully self-contained
// and completely independent of flashcards/decks — "My words" is its own
// collection and shares nothing with practice content.
export interface SavedWord {
  _id?: ObjectId;
  userId: ObjectId;
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
  status: CardStatus;
}

export interface PracticeDeck {
  id: string;
  name: string;
  createdAt: string;
  cards: PracticeCard[];
  resumeIndex?: number;      // General practice resume position
}