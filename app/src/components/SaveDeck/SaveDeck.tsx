"use client";

import { useState } from "react";
import { PracticeCard, PracticeDeck } from "@/app/src/models/domain";
import styles from "./SaveDeck.module.css";

interface Props {
  cards: PracticeCard[];
  onSaved: (deck: PracticeDeck) => void;
  onBack: () => void;
  sourceLang?: string;
  targetLang?: string;
}

export default function SaveDeck({ cards, onSaved, onBack, sourceLang, targetLang }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, cards, sourceLang, targetLang }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      const deck: PracticeDeck = await res.json();
      onSaved(deck);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Name your deck</h2>
        <p className={styles.subtitle}>{cards.length} cards ready to save</p>

        <input
          className={styles.input}
          type="text"
          placeholder="e.g. Spanish verbs, French food vocab…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          autoFocus
          maxLength={60}
        />

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button className={styles.btnBack} onClick={onBack} disabled={loading}>
            ← Back
          </button>
          <button
            className={styles.btnSave}
            onClick={handleSave}
            disabled={!name.trim() || loading}
          >
            {loading ? (
              <span className={styles.spinner}>
                <span className={styles.spinnerDot} />
                Saving…
              </span>
            ) : (
              "Save & start practice →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}