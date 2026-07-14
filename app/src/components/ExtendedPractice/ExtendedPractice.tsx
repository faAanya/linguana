"use client";

import { useState, useCallback } from "react";
import { PracticeDeck } from "@/app/src/models/domain";
import styles from "./ExtendedPractice.module.css";

interface Props {
  deck: PracticeDeck;
  onDone: () => void;
}

interface SentenceCard {
  masked: string;   // sentence with [translation] in brackets
  answer: string;   // the original word to recall
  full: string;     // natural sentence with the real word
  word: string;     // the source word this sentence belongs to
  translation: string;
}

type Stage = "setup" | "loading" | "practice" | "error";

export default function ExtendedPractice({ deck, onDone }: Props) {
  const [stage, setStage] = useState<Stage>("setup");
  const [count, setCount] = useState(3);
  const [cards, setCards] = useState<SentenceCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // Generate sentences for every word in the deck
  const handleStart = useCallback(async () => {
    setStage("loading");
    setErrorMsg(null);
    const words = deck.cards.filter((c) => c.word.trim());
    setProgress({ done: 0, total: words.length });

    const all: SentenceCard[] = [];

    try {
      for (let i = 0; i < words.length; i++) {
        const card = words[i];
        const res = await fetch("/api/generate-sentences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: card.word,
            translation: card.translation,
            count,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Generation failed");
        }
        const { sentences } = await res.json();
        sentences.forEach((s: { masked: string; answer: string; full: string }) => {
          all.push({
            masked: s.masked,
            answer: s.answer,
            full: s.full,
            word: card.word,
            translation: card.translation,
          });
        });
        setProgress({ done: i + 1, total: words.length });
      }

      if (all.length === 0) {
        throw new Error("No sentences were generated");
      }

      // Shuffle so sentences from the same word aren't adjacent
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }

      setCards(all);
      setIndex(0);
      setFlipped(false);
      setStage("practice");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  }, [deck.cards, count]);

  const next = () => {
    setFlipped(false);
    if (index + 1 >= cards.length) {
      onDone();
    } else {
      setIndex((i) => i + 1);
    }
  };

  // Render the masked sentence with the bracketed part highlighted
  const renderMasked = (masked: string) => {
    const parts = masked.split(/(\[[^\]]+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith("[") && part.endsWith("]")) {
        return (
          <span key={i} className={styles.blank}>
            {part.slice(1, -1)}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // ── Setup: pick how many sentences per word ──
  if (stage === "setup") {
    return (
      <div className={styles.centerWrap}>
        <div className={styles.setupCard}>
          <h2 className={styles.setupTitle}>Extended practice</h2>
          <p className={styles.setupSubtitle}>
            We'll create example sentences for each word. You'll see the sentence
            with the word shown in your language — recall it, then flip to check.
          </p>

          <div className={styles.countRow}>
            <span className={styles.countLabel}>Sentences per word</span>
            <div className={styles.countPicker}>
              {[1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  className={`${styles.countBtn} ${count === n ? styles.countBtnActive : ""}`}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <p className={styles.estimate}>
            {deck.cards.length} words × {count} = ~{deck.cards.length * count} sentences
          </p>

          <div className={styles.setupActions}>
            <button className={styles.btnSecondary} onClick={onDone}>Cancel</button>
            <button className={styles.btnPrimary} onClick={handleStart}>
              Start →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading: generating sentences ──
  if (stage === "loading") {
    return (
      <div className={styles.centerWrap}>
        <div className={styles.loadingCard}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>
            Generating sentences… {progress.done}/{progress.total} words
          </p>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (stage === "error") {
    return (
      <div className={styles.centerWrap}>
        <div className={styles.loadingCard}>
          <p className={styles.errorText}>{errorMsg}</p>
          <div className={styles.setupActions}>
            <button className={styles.btnSecondary} onClick={onDone}>Back</button>
            <button className={styles.btnPrimary} onClick={() => setStage("setup")}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Practice ──
  const current = cards[index];

  return (
    <div className={styles.centerWrap}>
      <button
        className={styles.exitBtn}
        onClick={onDone}
        aria-label="Exit practice"
        title="Exit practice"
      >
        ✕ Exit
      </button>

      <div className={styles.practiceWrap}>
        <div className={styles.header}>
          <span className={styles.deckName}>{deck.name} · Extended</span>
          <span className={styles.counter}>{index + 1} / {cards.length}</span>
        </div>

        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${((index) / cards.length) * 100}%` }}
          />
        </div>

        <div
          className={`${styles.card} ${flipped ? styles.cardFlipped : ""}`}
          onClick={() => setFlipped((f) => !f)}
          role="button"
          tabIndex={0}
          aria-label="Tap to reveal the word"
        >
          <div className={styles.cardSentence}>
            {renderMasked(current.masked)}
          </div>

          {flipped ? (
            <div className={styles.answerBlock}>
              <span className={styles.answerLabel}>Answer</span>
              <span className={styles.answerWord}>{current.answer}</span>
              <span className={styles.answerFull}>{current.full}</span>
            </div>
          ) : (
            <span className={styles.tapHint}>tap to reveal the word</span>
          )}
        </div>

        <div className={styles.actions}>
          {!flipped ? (
            <button className={styles.btnPrimary} onClick={() => setFlipped(true)}>
              Reveal
            </button>
          ) : (
            <button className={styles.btnPrimary} onClick={next}>
              {index + 1 >= cards.length ? "Finish" : "Next →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
