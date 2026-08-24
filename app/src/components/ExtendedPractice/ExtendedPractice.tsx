"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const MAX_ROTATION = 8;
const TAP_MAX_MOVEMENT = 8;
const SWIPE_TRIGGER_PX = 90; // minimum drag distance (any direction) to advance

export default function ExtendedPractice({ deck, onDone }: Props) {
  const [stage, setStage] = useState<Stage>("setup");
  const [mode, setMode] = useState<SentenceMode>("native");
  const [cards, setCards] = useState<SentenceCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // Swipe / flip animation state. The card can be dragged in any direction;
  // on release past the threshold it tucks to the back of the stack.
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [stageW, setStageW] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [exitTilt, setExitTilt] = useState(0);
  const [skipTransition, setSkipTransition] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const pointerId = useRef<number | null>(null);
  const movedDistance = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

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

  // Re-enable transitions one frame after a card swap
  useEffect(() => {
    if (skipTransition) {
      const id = requestAnimationFrame(() => setSkipTransition(false));
      return () => cancelAnimationFrame(id);
    }
  }, [skipTransition]);

  const commitSwipe = useCallback(() => {
    const isLast = index + 1 >= cards.length;
    setExitTilt(dragX >= 0 ? 4 : -4);
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      setDragX(0);
      setDragY(0);
      setSkipTransition(true);
      setFlipped(false);
      if (isLast) setFinished(true);
      else setIndex((i) => i + 1);
    }, 300);
  }, [index, cards.length, dragX]);

  const restart = () => {
    setCards((prev) => shuffle([...prev]));
    setIndex(0);
    setFlipped(false);
    setFinished(false);
    setDragX(0);
    setDragY(0);
  };

  // ── Pointer events (drag in any direction to swipe, tap to flip) ──
  const handlePointerDown = (e: React.PointerEvent) => {
    if (exiting) return;
    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    startY.current = e.clientY;
    movedDistance.current = 0;
    setStageW(stageRef.current?.clientWidth ?? window.innerWidth);
    setDragging(true);
    sceneRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || pointerId.current !== e.pointerId) return;
    const stageWidth = stageRef.current?.clientWidth ?? window.innerWidth;
    const stageHeight = stageRef.current?.clientHeight ?? 320;
    const halfW = stageWidth / 2;
    const halfH = stageHeight / 2;
    const rawX = e.clientX - startX.current;
    const rawY = e.clientY - startY.current;
    const dx = Math.max(-halfW, Math.min(halfW, rawX));
    const dy = Math.max(-halfH, Math.min(halfH, rawY));
    movedDistance.current = Math.hypot(rawX, rawY);
    setDragX(dx);
    setDragY(dy);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    if (!dragging) return;
    setDragging(false);

    // Tap → flip
    if (movedDistance.current <= TAP_MAX_MOVEMENT) {
      setDragX(0);
      setDragY(0);
      setFlipped((f) => !f);
      return;
    }

    // Swipe in any direction, if far enough → send to back of stack
    if (Math.hypot(dragX, dragY) >= SWIPE_TRIGGER_PX) {
      commitSwipe();
    } else {
      setDragX(0);
      setDragY(0);
    }
  };

  // ── Keyboard (only while practicing) ──
  useEffect(() => {
    if (stage !== "practice" || finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (exiting) return;
      if (e.key === " ") { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key.startsWith("Arrow")) { e.preventDefault(); commitSwipe(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, finished, commitSwipe, exiting]);

  const stripBraces = (s: string) => s.replace(/[[\]]/g, "");

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

  const modeToggle = (
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
            Each word gets one example sentence. Choose how it&rsquo;s shown, then
            tap a card to reveal and swipe to move on.
          </p>

          <div className={styles.modeRow}>
            <span className={styles.countLabel}>Display mode</span>
            {modeToggle}
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

  // ── Finished ──
  if (finished) {
    return (
      <div className={styles.centerWrap}>
        <div className={styles.setupCard}>
          <span className={styles.finishedEmoji}>🎉</span>
          <h2 className={styles.setupTitle}>You got to the end!</h2>
          <p className={styles.setupSubtitle}>
            {cards.length} sentence{cards.length === 1 ? "" : "s"} practiced.
          </p>
          <div className={styles.setupActions}>
            <button className={styles.btnSecondary} onClick={onDone}>Quit</button>
            <button className={styles.btnPrimary} onClick={restart}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Practice ──
  const current = cards[index];

  const half = stageW / 2 || 1;
  const dragRatio = Math.max(-1, Math.min(1, dragX / half));
  const remaining = cards.length - index;

  // Exit "to the back of the stack": the card shrinks to the deepest stack
  // depth and (via a lowered z-index) drops behind the other cards — it
  // doesn't fly off or fade, it tucks to the end of the deck.
  const transform = exiting
    ? `translateY(-20px) scale(0.88) rotate(${exitTilt}deg)`
    : `translateX(${dragX}px) translateY(${dragY}px) rotate(${dragRatio * MAX_ROTATION}deg)`;

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

        <div className={styles.stage} ref={stageRef}>
          {/* decorative cards behind, for the stack depth effect */}
          {remaining > 2 && <div className={`${styles.stackBehind} ${styles.depth2}`} aria-hidden />}
          {remaining > 1 && <div className={`${styles.stackBehind} ${styles.depth1}`} aria-hidden />}

          <div
            ref={sceneRef}
            className={`${styles.cardScene} ${flipped ? styles.flipped : ""} ${
              dragging || skipTransition ? styles.draggingScene : styles.settlingScene
            } ${skipTransition ? styles.noFlip : ""}`}
            data-exiting={exiting ? "true" : "false"}
            style={{ transform, zIndex: exiting ? 0 : 3 }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            role="button"
            tabIndex={0}
            aria-label="Tap to reveal, swipe for next"
          >
            <div className={styles.cardInner}>
              {/* Front — the sentence */}
              <div className={styles.cardFace}>
                <span className={styles.faceLabel}>sentence</span>
                <div className={styles.cardSentence}>
                  {mode === "native"
                    ? renderMasked(current.masked)
                    : renderWithWord(current.full, current.answer || current.word)}
                </div>
                <span className={styles.tapHint}>tap to reveal · swipe for next</span>
              </div>

              {/* Back — the answer */}
              <div className={`${styles.cardFace} ${styles.cardBack}`}>
                <span className={styles.faceLabel}>answer</span>
                <span className={styles.answerWord}>
                  {mode === "native" ? current.answer || current.word : current.translation}
                </span>
                <span className={styles.answerFull}>
                  {current.fullTranslation || stripBraces(current.full)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
