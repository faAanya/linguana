export interface Card {
  word: string;
  translation: string;
  status: "learning" | "known";
}

export interface Deck {
  id: string;
  name: string;
  createdAt: string;
  cards: Card[];
}