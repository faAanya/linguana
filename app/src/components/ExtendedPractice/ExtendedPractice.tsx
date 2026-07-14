"use client";

import { useCallback, useState } from "react";
import { PracticeDeck, SentenceMode } from "@/app/src/models/domain";
import styles from "./ExtendedPractice.module.css";

interface Props {
  deck: PracticeDeck;
  onDone: () => void;
}

interface SentenceCard {
  full: string;            // sentence with the target word (learning language)
  masked: string;          // target word replaced by [native translation]
  answer: string;          // the target word
  fullTranslation: string; // whole sentence in the native language
  word: string;
  translation: string;
}

type Stage = "setup" | "loading" | "practice" | "error";

export default function ExtendedPractice({ deck, onDone }: Props) {
  const [stage, setStage] = useState<Stage>("setup");
  const [mode, setMode] = useState<SentenceMode>("native");
  const [cards, setCards] = useState<SentenceCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const shuffle = (arr: SentenceCard[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const handleStart = useCallback(async () => {
    setStage("loading");
    setErrorMsg(null);
    setProgress({ done: 0, total: deck.cards.length });

    try {
      let all: SentenceCard[] = [];

      if (deck.id) {
        // Saved deck: sentences are generated once and stored server-side.
        const res = await fetch(`/api/decks/${deck.id}/sentences`, { method: "POST" });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to prepare sentences");
        }
        const { sentences } = await res.json();
        all = (sentences as SentenceCard[]).map((s) => ({
          full: s.full,
          masked: s.masked,
          answer: s.answer,
          fullTranslation: s.fullTranslation ?? "",
          word: s.word,
          translation: s.translation,
        }));
      } else {
        // Ephemeral "practice once" deck: generate in-memory, not stored.
        const words = deck.cards.filter((c) => c.word.trim());
        for (let i = 0; i < words.length; i++) {
          const card = words[i];
          const res = await fetch("/api/generate-sentences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ word: card.word, translation: card.translation, count: 1 }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error ?? "Generation failed");
          }
          const { sentences } = await res.json();
          const s = sentences?.[0];
          if (s) {
            all.push({
              full: s.full,
              masked: s.masked,
              answer: s.answer ?? card.word,
              fullTranslation: s.fullTranslation ?? "",
              word: card.word,
              translation: card.translation,
            });
          }
          setProgress({ done: i + 1, total: words.length });
        }
      }

      if (all.length === 0) throw new Error("No sentences were generated");

      setCards(shuffle(all));
      setIndex(0);
      setFlipped(false);
      setStage("practice");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  }, [deck.cards, deck.id]);

  const next = () => {
    setFlipped(false);
    if (index + 1 >= cards.length) onDone();
    else setIndex((i) => i + 1);
  };

  // Strip any square brackets so they never render in the sentence text.
  const stripBraces = (s: string) => s.replace(/[[\]]/g, "");

  // Render the masked sentence with the native word highlighted (no brackets).
  const renderMasked = (masked: string) => {
    const parts = masked.split(/(\[[^\]]+\])/g);
    return parts.map((part, i) =>
      part.startsWith("[") && part.endsWith("]") ? (
        <span key={i} className={styles.blank}>{part.slice(1, -1)}</span>
      ) : (
        <span key={i}>{stripBraces(part)}</span>
      )
    );
  };

  // Render the full sentence with the target word highlighted.
  const renderWithWord = (full: string, word: string) => {
    if (!word.trim()) return full;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = full.split(new RegExp(`(${escaped})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === word.toLowerCase() ? (
        <span key={i} className={styles.blank}>{part}</span>
      ) : (
        <span key={i}>{stripBraces(part)}</span>
      )
    );
  };

  const ModeToggle = () => (
    <div className={styles.modeToggle} role="tablist" aria-label="Sentence display mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "native"}
        className={`${styles.modeBtn} ${mode === "native" ? styles.modeBtnActive : ""}`}
        onClick={() => setMode("native")}
      >
        Native word
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "word"}
        className={`${styles.modeBtn} ${mode === "word" ? styles.modeBtnActive : ""}`}
        onClick={() => setMode("word")}
      >
        Learning word
      </button>
    </div>
  );

  // ── Setup ──
  if (stage === "setup") {
    return (
      <div className={styles.centerWrap}>
        <div className={styles.setupCard}>
          <h2 className={styles.setupTitle}>Extended practice</h2>
          <p className={styles.setupSubtitle}>
            Each word gets one example sentence. Choose how it&rsquo;s shown — you can
            switch modes any time during practice.
          </p>

          <div className={styles.modeRow}>
            <span className={styles.countLabel}>Display mode</span>
            <ModeToggle />
          </div>

          <p className={styles.modeHint}>
            {mode === "native"
              ? "The sentence shows the target word in your native language — recall the learning word."
              : "The sentence is shown fully in the learning language — recall the meaning."}
          </p>

          <div className={styles.setupActions}>
            <button className={styles.btnSecondary} onClick={onDone}>Cancel</button>
            <button className={styles.btnPrimary} onClick={handleStart}>Start →</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (stage === "loading") {
    return (
      <div className={styles.centerWrap}>
        <div className={styles.loadingCard}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>
            {deck.id
              ? "Preparing your sentences…"
              : `Generating sentences… ${progress.done}/${progress.total} words`}
          </p>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 30}%` }}
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
            <button className={styles.btnPrimary} onClick={() => setStage("setup")}>Try again</button>
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
          <div className={styles.progressFill} style={{ width: `${(index / cards.length) * 100}%` }} />
        </div>

        <div
          className={`${styles.card} ${flipped ? styles.cardFlipped : ""}`}
          onClick={() => setFlipped((f) => !f)}
          role="button"
          tabIndex={0}
          aria-label="Tap to reveal"
        >
          <div className={styles.cardSentence}>
            {mode === "native"
              ? renderMasked(current.masked)
              : renderWithWord(current.full, current.answer || current.word)}
          </div>

          {flipped ? (
            <div className={styles.answerBlock}>
              {/* the word being learned, above the native-language sentence */}
              <span className={styles.answerWord}>{current.answer || current.word}</span>
              <span className={styles.answerFull}>
                {current.fullTranslation || stripBraces(current.full)}
              </span>
            </div>
          ) : (
            <span className={styles.tapHint}>tap to reveal</span>
          )}
        </div>

        <div className={styles.actions}>
          {flipped && (
            <button className={styles.btnPrimary} onClick={next}>
              {index + 1 >= cards.length ? "Finish" : "Next →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
