import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Deck, Card } from '../models/index';

const DB_PATH = path.join(process.cwd(), "data", "decks.json");

async function ensureDbFile() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, "[]", "utf-8");
  }
}

export async function readDecks(): Promise<Deck[]> {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, "utf-8");
  try {
    return JSON.parse(raw) as Deck[];
  } catch {
    return [];
  }
}

async function writeDecks(decks: Deck[]): Promise<void> {
  await ensureDbFile();
  await fs.writeFile(DB_PATH, JSON.stringify(decks, null, 2), "utf-8");
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const decks = await readDecks();
  return decks.find((d) => d.id === id);
}

export async function createDeck(
  name: string,
  cards: Pick<Card, "word" | "translation">[]
): Promise<Deck> {
  const decks = await readDecks();

  const deck: Deck = {
    id: randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    cards: cards.map((c) => ({
      word: c.word,
      translation: c.translation,
      status: "learning",
    })),
  };

  decks.unshift(deck);
  await writeDecks(decks);
  return deck;
}

export async function updateCardStatus(
  deckId: string,
  cardIndex: number,
  status: Card["status"]
): Promise<Deck | undefined> {
  const decks = await readDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck || !deck.cards[cardIndex]) return undefined;

  deck.cards[cardIndex].status = status;
  await writeDecks(decks);
  return deck;
}

export async function deleteDeck(id: string): Promise<void> {
  const decks = await readDecks();
  await writeDecks(decks.filter((d) => d.id !== id));
}