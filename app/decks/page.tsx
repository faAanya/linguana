"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/src/components/Auth/AuthContext";
import PracticeLauncher from "@/app/src/components/ExtendedPractice/PracticeLauncher";
import { PracticeDeck } from "@/app/src/models/domain";
import styles from "./page.module.css";

interface DeckSummary {
  id: string;
  name: string;
  createdAt: string;
  cardCount: number;
}

export default function DecksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active practice session (loaded full deck)
  const [activeDeck, setActiveDeck] = useState<PracticeDeck | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDecks = useCallback(() => {
    setFetching(true);
    fetch("/api/decks")
      .then((r) => r.json())
      .then((data) => setDecks(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load decks"))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    loadDecks();
  }, [user, loading, router, loadDecks]);

  // Click a card → load full deck → start practice
  const handleStartPractice = async (deckId: string) => {
    setLaunching(deckId);
    try {
      const res = await fetch(`/api/decks/${deckId}`);
      if (!res.ok) throw new Error("Failed to load deck");
      const deck: PracticeDeck = await res.json();
      setActiveDeck(deck);
    } catch {
      setError("Could not start practice");
    } finally {
      setLaunching(null);
    }
  };

  const handleDelete = async (deckId: string) => {
    try {
      const res = await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
      setDeletingId(null);
    } catch {
      setError("Failed to delete deck");
    }
  };

  // If practicing, render the launcher full-screen
  if (activeDeck) {
    return (
      <PracticeLauncher
        deck={activeDeck}
        onDone={() => {
          setActiveDeck(null);
          loadDecks();
        }}
      />
    );
  }

  if (loading || fetching) {
    return (
      <main className={styles.main}>
        <div className={styles.spinner} />
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>My decks</h1>
        <p className={styles.subtitle}>
          {decks.length === 0
            ? "You haven't saved any decks yet"
            : `${decks.length} deck${decks.length === 1 ? "" : "s"} · click to practice`}
        </p>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {decks.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Create one from the{" "}
            <a href="/import" className={styles.emptyLink}>Create deck</a> page,
            or build one from{" "}
            <a href="/words" className={styles.emptyLink}>your words</a>.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {decks.map((deck) => (
            <div key={deck.id} className={styles.card}>
              <button
                className={styles.cardMain}
                onClick={() => handleStartPractice(deck.id)}
                disabled={launching === deck.id}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardName}>{deck.name}</span>
                  <span className={styles.cardCount}>{deck.cardCount} cards</span>
                </div>
                <span className={styles.cardDate}>
                  {launching === deck.id
                    ? "Loading…"
                    : new Date(deck.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                </span>
                <span className={styles.playHint}>▶ Practice</span>
              </button>

              <div className={styles.cardActions}>
                <button
                  className={styles.editBtn}
                  onClick={() => router.push(`/decks/${deck.id}`)}
                  title="Edit deck"
                  aria-label="Edit deck"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
                </button>

                {deletingId === deck.id ? (
                  <div className={styles.confirmDelete}>
                    <button className={styles.confirmYes} onClick={() => handleDelete(deck.id)}>
                      Delete
                    </button>
                    <button className={styles.confirmNo} onClick={() => setDeletingId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles.deleteBtn}
                    onClick={() => setDeletingId(deck.id)}
                    title="Delete deck"
                    aria-label="Delete deck"
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4l.5 9a1 1 0 001 1h3a1 1 0 001-1L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
