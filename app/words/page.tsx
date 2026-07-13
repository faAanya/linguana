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

type TimeRange = "day" | "3days" | "week" | "month";

// Number of calendar days each range spans (anchored to local midnight),
// so "Day" means "today", "3 days" means today + the two prior days, etc.
const RANGE_DAYS: Record<TimeRange, number> = {
  day: 1,
  "3days": 3,
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
  // Kept as a raw string so the field can be emptied while typing; any
  // positive integer is allowed, and an empty field falls back to 1.
  const [countInput, setCountInput] = useState("10");
  const count = countInput === "" ? 1 : Math.max(1, parseInt(countInput, 10) || 1);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(words.map((w) => w.id)));
  const selectNone = () => setSelected(new Set());

  // Words are already sorted newest-first by the API.
  const selectLastN = (n: number) =>
    setSelected(new Set(words.slice(0, n).map((w) => w.id)));

  const selectRandomN = (n: number) => {
    const shuffled = [...words];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setSelected(new Set(shuffled.slice(0, n).map((w) => w.id)));
  };

  const selectRange = (range: TimeRange) => {
    // Anchor to the start of today, then step back whole calendar days.
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (RANGE_DAYS[range] - 1));
    const cutoffMs = cutoff.getTime();
    setSelected(
      new Set(
        words.filter((w) => new Date(w.createdAt).getTime() >= cutoffMs).map((w) => w.id)
      )
    );
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

  // ── Build cards from the current selection ─────────────────────
  const selectedWords = useMemo(
    () => words.filter((w) => selected.has(w.id)),
    [words, selected]
  );

  const buildCards = (): PracticeCard[] =>
    selectedWords.map((w) => ({
      word: w.word,
      translation: w.translation,
      status: "learning" as const,
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
  };

  const handleSaveDeck = () => {
    if (selectedWords.length === 0) return;
    setSaveLangs(dominantLangs());
    setSavingCards(buildCards());
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
              <button className={styles.chip} onClick={selectAll}>All</button>
              <button className={styles.chip} onClick={selectNone}>None</button>
              <button className={styles.chip} onClick={() => selectLastN(count)}>Last {count}</button>
              <button className={styles.chip} onClick={() => selectRandomN(count)}>Random {count}</button>
              <span className={styles.countControl}>
                N
                <input
                  className={styles.countInput}
                  type="text"
                  inputMode="numeric"
                  value={countInput}
                  onChange={(e) => setCountInput(e.target.value.replace(/\D/g, ""))}
                  aria-label="Number of words"
                />
              </span>
            </div>

            <div className={styles.builderRow}>
              <span className={styles.builderLabel}>From last</span>
              <button className={styles.chip} onClick={() => selectRange("day")}>Day</button>
              <button className={styles.chip} onClick={() => selectRange("3days")}>3 days</button>
              <button className={styles.chip} onClick={() => selectRange("week")}>Week</button>
              <button className={styles.chip} onClick={() => selectRange("month")}>Month</button>
            </div>

            <div className={styles.builderActions}>
              <span className={styles.selectedCount}>{selectedCount} selected</span>
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
                        <span className={styles.word}>{w.word}</span>
                        <span className={styles.arrow}>→</span>
                        <span className={styles.translation}>{w.translation}</span>
                      </div>
                      <span className={styles.langBadge}>
                        {LANGUAGE_MAP[w.sourceLanguage]?.flag ?? ""}
                        {" → "}
                        {LANGUAGE_MAP[w.targetLanguage]?.flag ?? w.targetLanguage}
                      </span>
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
