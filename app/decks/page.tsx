"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/src/components/Auth/AuthContext";
import PracticeLauncher from "@/app/src/components/ExtendedPractice/PracticeLauncher";
import Spinner from "@/app/src/components/common/Spinner/Spinner";
import IconButton from "@/app/src/components/common/IconButton/IconButton";
import ConfirmInline from "@/app/src/components/common/ConfirmInline/ConfirmInline";
import { EditIcon, TrashIcon, PinIcon } from "@/app/src/components/common/icons/icons";
import { PracticeDeck } from "@/app/src/models/domain";
import styles from "./page.module.css";

interface DeckSummary {
  id: string;
  name: string;
  createdAt: string;
  cardCount: number;
  pinned: boolean;
}

// Pinned decks first, then newest first.
function sortDecks(arr: DeckSummary[]): DeckSummary[] {
  return [...arr].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
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
      .then((data) => setDecks(sortDecks(Array.isArray(data) ? data : [])))
      .catch(() => setError("Failed to load decks"))
      .finally(() => setFetching(false));
  }, []);

  const handleTogglePin = async (deck: DeckSummary) => {
    const nextPinned = !deck.pinned;
    // Optimistic update + reorder
    setDecks((prev) =>
      sortDecks(prev.map((d) => (d.id === deck.id ? { ...d, pinned: nextPinned } : d)))
    );
    try {
      const res = await fetch(`/api/decks/${deck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: nextPinned }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      setDecks((prev) =>
        sortDecks(prev.map((d) => (d.id === deck.id ? { ...d, pinned: deck.pinned } : d)))
      );
      setError("Failed to update pin");
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load on mount
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
        <Spinner />
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
                  <span className={styles.cardMeta}>
                    {deck.pinned && (
                      <span className={styles.pinnedMark} aria-hidden title="Pinned">
                        <PinIcon size={13} />
                      </span>
                    )}
                    <span className={styles.cardCount}>{deck.cardCount} cards</span>
                  </span>
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
                <IconButton
                  variant="pin"
                  active={deck.pinned}
                  className={styles.pinLeft}
                  onClick={() => handleTogglePin(deck)}
                  title={deck.pinned ? "Unpin deck" : "Pin deck"}
                  aria-label={deck.pinned ? "Unpin deck" : "Pin deck"}
                  aria-pressed={deck.pinned}
                >
                  <PinIcon />
                </IconButton>

                <IconButton
                  onClick={() => router.push(`/decks/${deck.id}`)}
                  title="Edit deck"
                  aria-label="Edit deck"
                >
                  <EditIcon />
                </IconButton>

                {deletingId === deck.id ? (
                  <ConfirmInline
                    onConfirm={() => handleDelete(deck.id)}
                    onCancel={() => setDeletingId(null)}
                  />
                ) : (
                  <IconButton
                    variant="danger"
                    onClick={() => setDeletingId(deck.id)}
                    title="Delete deck"
                    aria-label="Delete deck"
                  >
                    <TrashIcon />
                  </IconButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
