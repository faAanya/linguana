"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/src/components/Auth/AuthContext";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }

    fetch("/api/decks")
      .then((r) => r.json())
      .then((data) => setDecks(data))
      .catch(() => setError("Failed to load decks"))
      .finally(() => setFetching(false));
  }, [user, loading, router]);

  if (loading || fetching) {
    return (
      <main className={styles.main}>
        <div className={styles.spinner} />
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.main}>
        <p className={styles.error}>{error}</p>
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
            : `${decks.length} deck${decks.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {decks.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Go back to the{" "}
            <a href="/" className={styles.emptyLink}>home page</a>{" "}
            to create your first deck.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {decks.map((deck) => (
            <div key={deck.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.cardName}>{deck.name}</span>
                <span className={styles.cardCount}>{deck.cardCount} cards</span>
              </div>
              <span className={styles.cardDate}>
                {new Date(deck.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}