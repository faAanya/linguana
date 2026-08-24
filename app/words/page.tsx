"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/src/components/Auth/AuthContext";
import { LANGUAGE_MAP } from "@/app/src/models/languages";
import { PracticeCard, PracticeDeck } from "@/app/src/models/domain";
import PracticeLauncher from "@/app/src/components/ExtendedPractice/PracticeLauncher";
import SaveDeck from "@/app/src/components/SaveDeck/SaveDeck";
import styles from "./page.module.css";

interface WordItem {
  id: string;
  word: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: string;
}

type TimeRange = "day" | "week" | "month";

// Number of calendar days each range spans (anchored to local midnight),
// so "Day" means "today", "Week" means the last 7 calendar days, etc.
const RANGE_DAYS: Record<TimeRange, number> = {
  day: 1,
  week: 7,
  month: 30,
};

export default function MyWordsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [words, setWords] = useState<WordItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Which quick-select control produced the current selection (so pressing
  // the same one again clears it). Manual checkbox edits reset this to null.
  const [activeSelection, setActiveSelection] = useState<"all" | TimeRange | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  // Practice / save flows
  const [practiceDeck, setPracticeDeck] = useState<PracticeDeck | null>(null);
  const [savingCards, setSavingCards] = useState<PracticeCard[] | null>(null);
  const [saveLangs, setSaveLangs] = useState<{ source: string; target: string }>({
    source: "unknown",
    target: "unknown",
  });

  const loadWords = useCallback(() => {
    setFetching(true);
    fetch("/api/words")
      .then((r) => r.json())
      .then((data) => setWords(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load words"))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    loadWords();
  }, [user, loading, router, loadWords]);

  // ── Selection helpers ──────────────────────────────────────────
  const clearSelection = () => {
    setSelected(new Set());
    setActiveSelection(null);
  };

  const toggle = (id: string) => {
    // A manual edit means the selection no longer matches a quick-select.
    setActiveSelection(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Pressing the same quick-select control again clears the selection.
  const applyAll = () => {
    if (activeSelection === "all") {
      clearSelection();
      return;
    }
    setSelected(new Set(words.map((w) => w.id)));
    setActiveSelection("all");
  };

  const rangeIds = (range: TimeRange) => {
    // Anchor to the start of today, then step back whole calendar days.
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (RANGE_DAYS[range] - 1));
    const cutoffMs = cutoff.getTime();
    return words
      .filter((w) => new Date(w.createdAt).getTime() >= cutoffMs)
      .map((w) => w.id);
  };

  const applyRange = (range: TimeRange) => {
    if (activeSelection === range) {
      clearSelection();
      return;
    }
    setSelected(new Set(rangeIds(range)));
    setActiveSelection(range);
  };

  // ── Edit / delete ──────────────────────────────────────────────
  const startEdit = (w: WordItem) => {
    setEditingId(w.id);
    setEditWord(w.word);
    setEditTranslation(w.translation);
  };

  const saveEdit = async (id: string) => {
    if (!editWord.trim() || !editTranslation.trim()) return;
    try {
      const res = await fetch(`/api/words/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: editWord.trim(), translation: editTranslation.trim() }),
      });
      if (!res.ok) throw new Error();
      setWords((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, word: editWord.trim(), translation: editTranslation.trim() } : w
        )
      );
      setEditingId(null);
    } catch {
      setError("Failed to save changes");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/words/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setWords((prev) => prev.filter((w) => w.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeletingId(null);
    } catch {
      setError("Failed to delete word");
    }
  };

  const handleDeleteSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setDeletingSelected(true);
    setError(null);
    try {
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/words/${id}`, { method: "DELETE" }))
      );
      const deleted = new Set(
        ids.filter((_, i) => results[i].ok)
      );
      setWords((prev) => prev.filter((w) => !deleted.has(w.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        deleted.forEach((id) => next.delete(id));
        return next;
      });
      setActiveSelection(null);
      setConfirmDeleteSelected(false);
      if (deleted.size !== ids.length) setError("Some words could not be deleted");
    } catch {
      setError("Failed to delete selected words");
    } finally {
      setDeletingSelected(false);
    }
  };

  // ── Build cards from the current selection ─────────────────────
  const selectedWords = useMemo(
    () => words.filter((w) => selected.has(w.id)),
    [words, selected]
  );

  const buildCards = (): PracticeCard[] =>
    selectedWords.map((w) => ({
      word: w.word,
      translation: w.translation,
      status: "in_progress" as const,
    }));

  const dominantLangs = () => {
    // Use the most recent selected word's language pair for the deck.
    const first = selectedWords[0];
    return {
      source: first?.sourceLanguage ?? "unknown",
      target: first?.targetLanguage ?? "unknown",
    };
  };

  const handlePracticeOnce = () => {
    if (selectedWords.length === 0) return;
    setPracticeDeck({
      id: "", // ephemeral: not persisted, status updates are no-ops
      name: `${selectedWords.length} word${selectedWords.length === 1 ? "" : "s"}`,
      createdAt: new Date().toISOString(),
      cards: buildCards(),
    });
    clearSelection();
  };

  const handleSaveDeck = () => {
    if (selectedWords.length === 0) return;
    setSaveLangs(dominantLangs());
    setSavingCards(buildCards());
    clearSelection();
  };

  // ── Render: full-screen sub-flows ──────────────────────────────
  if (practiceDeck) {
    return <PracticeLauncher deck={practiceDeck} onDone={() => setPracticeDeck(null)} />;
  }

  if (savingCards) {
    return (
      <SaveDeck
        cards={savingCards}
        sourceLang={saveLangs.source}
        targetLang={saveLangs.target}
        onBack={() => setSavingCards(null)}
        onSaved={(deck) => {
          setSavingCards(null);
          setPracticeDeck(deck);
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

  const selectedCount = selected.size;

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>My words</h1>
        <p className={styles.subtitle}>
          {words.length === 0
            ? "You haven't saved any words yet"
            : `${words.length} word${words.length === 1 ? "" : "s"} in your collection`}
        </p>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {words.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Go to the <a href="/add-words" className={styles.emptyLink}>Add words</a> page to
            start building your collection.
          </p>
        </div>
      ) : (
        <>
          {/* ── Flashcard builder ── */}
          <div className={styles.builder}>
            <div className={styles.builderTitle}>Create flashcards</div>

            <div className={styles.builderRow}>
              <span className={styles.builderLabel}>Pick</span>
              <button
                className={`${styles.chip} ${activeSelection === "all" ? styles.chipActive : ""}`}
                onClick={applyAll}
              >
                All
              </button>
            </div>

            <div className={styles.builderRow}>
              <span className={styles.builderLabel}>From last</span>
              {(["day", "week", "month"] as const).map((r) => (
                <button
                  key={r}
                  className={`${styles.chip} ${activeSelection === r ? styles.chipActive : ""}`}
                  onClick={() => applyRange(r)}
                >
                  {r === "day" ? "Day" : r === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>

            <div className={styles.builderActions}>
              <span className={styles.selectedCount}>{selectedCount} selected</span>

              {confirmDeleteSelected ? (
                <>
                  <span className={styles.confirmText}>
                    Delete {selectedCount} word{selectedCount === 1 ? "" : "s"}?
                  </span>
                  <button
                    className={styles.btnDanger}
                    onClick={handleDeleteSelected}
                    disabled={deletingSelected}
                  >
                    {deletingSelected ? "Deleting…" : "Delete"}
                  </button>
                  <button
                    className={styles.btnSecondary}
                    onClick={() => setConfirmDeleteSelected(false)}
                    disabled={deletingSelected}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={styles.btnDangerGhost}
                    onClick={() => setConfirmDeleteSelected(true)}
                    disabled={selectedCount === 0}
                  >
                    Delete selected
                  </button>
                  <button
                    className={styles.btnSecondary}
                    onClick={handlePracticeOnce}
                    disabled={selectedCount === 0}
                  >
                    ▶ Practice once
                  </button>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleSaveDeck}
                    disabled={selectedCount === 0}
                  >
                    Save as deck
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Word list ── */}
          <ul className={styles.list}>
            {words.map((w) => {
              const isSelected = selected.has(w.id);
              const isEditing = editingId === w.id;
              return (
                <li
                  key={w.id}
                  className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                >
                  <input
                    type="checkbox"
                    className={styles.check}
                    checked={isSelected}
                    onChange={() => toggle(w.id)}
                    aria-label={`Select ${w.word}`}
                  />

                  {isEditing ? (
                    <div className={styles.editFields}>
                      <input
                        className={styles.editInput}
                        value={editWord}
                        onChange={(e) => setEditWord(e.target.value)}
                        placeholder="word"
                      />
                      <span className={styles.arrow}>→</span>
                      <input
                        className={styles.editInput}
                        value={editTranslation}
                        onChange={(e) => setEditTranslation(e.target.value)}
                        placeholder="translation"
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(w.id)}
                      />
                      <button className={styles.saveEditBtn} onClick={() => saveEdit(w.id)}>Save</button>
                      <button className={styles.cancelEditBtn} onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div className={styles.pair}>
                        <span className={styles.wordLine}>
                          <span className={styles.langFlag}>{LANGUAGE_MAP[w.sourceLanguage]?.flag ?? ""}</span>
                          <span className={styles.word}>{w.word}</span>
                        </span>
                        <span className={styles.translationLine}>
                          <span className={styles.langFlag}>{LANGUAGE_MAP[w.targetLanguage]?.flag ?? ""}</span>
                          <span className={styles.translation}>{w.translation}</span>
                        </span>
                      </div>
                      <div className={styles.rowActions}>
                        <button
                          className={styles.iconBtn}
                          onClick={() => startEdit(w)}
                          title="Edit word"
                          aria-label="Edit word"
                        >
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        {deletingId === w.id ? (
                          <div className={styles.confirmDelete}>
                            <button className={styles.confirmYes} onClick={() => handleDelete(w.id)}>Delete</button>
                            <button className={styles.confirmNo} onClick={() => setDeletingId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <button
                            className={`${styles.iconBtn} ${styles.deleteBtn}`}
                            onClick={() => setDeletingId(w.id)}
                            title="Delete word"
                            aria-label="Delete word"
                          >
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                              <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4l.5 9a1 1 0 001 1h3a1 1 0 001-1L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
