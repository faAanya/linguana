"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/app/src/components/Auth/AuthContext";
import styles from "./page.module.css";

interface EditCard {
  _id?: string;       // existing cards have an id; new ones don't
  key: string;        // stable react key
  word: string;
  translation: string;
}

let keyCounter = 0;
const nextKey = () => `edit-${++keyCounter}-${Date.now()}`;

export default function EditDeckPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const deckId = params.id as string;

  const [name, setName] = useState("");
  const [cards, setCards] = useState<EditCard[]>([]);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    fetch(`/api/decks/${deckId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Deck not found");
        return r.json();
      })
      .then((deck) => {
        setName(deck.name);
        setCards(
          deck.cards.map((c: { _id: string; word: string; translation: string }) => ({
            _id: c._id,
            key: nextKey(),
            word: c.word,
            translation: c.translation,
          }))
        );
      })
      .catch(() => setError("Could not load this deck"))
      .finally(() => setFetching(false));
  }, [user, loading, deckId, router]);

  const updateCard = (key: string, field: "word" | "translation", value: string) => {
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)));
  };

  const deleteCard = (key: string) => {
    setCards((prev) => prev.filter((c) => c.key !== key));
  };

  const addCard = () => {
    setCards((prev) => [...prev, { key: nextKey(), word: "", translation: "" }]);
  };

  const validCards = cards.filter((c) => c.word.trim() && c.translation.trim());

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Deck name can't be empty");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          cards: validCards.map((c) => ({
            _id: c._id,
            word: c.word,
            translation: c.translation,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      setMessage("Saved!");
      setTimeout(() => router.push("/decks"), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading || fetching) {
    return (
      <main className={styles.main}>
        <div className={styles.spinner} />
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <button className={styles.backLink} onClick={() => router.push("/decks")}>
            ← Back to decks
          </button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Deck name</label>
          <input
            className={styles.nameInput}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.cardsLabel}>
            <span className={styles.label}>Flashcards</span>
            <span className={styles.count}>{validCards.length} valid</span>
          </div>

          <div className={styles.cardsList}>
            {cards.map((card) => (
              <div key={card.key} className={styles.cardRow}>
                <input
                  className={styles.cardInput}
                  type="text"
                  value={card.word}
                  placeholder="word"
                  onChange={(e) => updateCard(card.key, "word", e.target.value)}
                />
                <span className={styles.sep}>→</span>
                <input
                  className={styles.cardInput}
                  type="text"
                  value={card.translation}
                  placeholder="translation"
                  onChange={(e) => updateCard(card.key, "translation", e.target.value)}
                />
                <button
                  className={styles.deleteRowBtn}
                  onClick={() => deleteCard(card.key)}
                  title="Delete card"
                  aria-label="Delete card"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button className={styles.addBtn} onClick={addCard}>
            + Add card
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.success}>{message}</p>}

        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={() => router.push("/decks")}>
            Cancel
          </button>
          <button
            className={styles.btnSave}
            onClick={handleSave}
            disabled={saving || validCards.length === 0}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </main>
  );
}