"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { PracticeCard, PracticeDeck } from "@/app/src/models/domain";
import styles from "./FlashCards.module.css";

interface Props {
  deck: PracticeDeck;
  onDone: () => void;
}

const MAX_ROTATION = 10;
const TAP_MAX_MOVEMENT = 8;
const ZONE_TRIGGER_RATIO = 0.92;

// The play queue = in-progress cards, starting at `fromIndex` (resume point).
// If nothing remains from there, a fresh pass over ALL in-progress cards.
function inProgressQueue(cards: PracticeCard[], fromIndex: number): number[] {
  const fromHere = cards
    .map((_, i) => i)
    .filter((i) => cards[i].status === "in_progress" && i >= fromIndex);
  if (fromHere.length > 0) return fromHere;
  return cards.map((_, i) => i).filter((i) => cards[i].status === "in_progress");
}

export default function Flashcards({ deck, onDone }: Props) {
  const [cards, setCards] = useState<PracticeCard[]>(deck.cards);
  const [queue, setQueue] = useState<number[]>(() => {
    const resume = deck.resumeIndex ?? 0;
    const start = resume >= deck.cards.length ? 0 : resume;
    return inProgressQueue(deck.cards, start);
  });
  const [qpos, setQpos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [skipTransition, setSkipTransition] = useState(false);

  // Drag state
  const [dragX, setDragX] = useState(0);
  const [stageW, setStageW] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [activeZone, setActiveZone] = useState<"known" | "learning" | null>(null);
  const [exitDirection, setExitDirection] = useState<"known" | "learning" | null>(null);

  const startX = useRef(0);
  const pointerId = useRef<number | null>(null);
  const movedDistance = useRef(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const learnt = cards.filter((c) => c.status === "learnt").length;
  const inProgress = cards.filter((c) => c.status === "in_progress").length;
  const showSummary = finished || queue.length === 0;
  const current = cards[queue[qpos]];
  const progress = queue.length ? Math.round((qpos / queue.length) * 100) : 0;

  // Lock page scroll during practice
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  useEffect(() => {
    if (skipTransition) {
      const id = requestAnimationFrame(() => setSkipTransition(false));
      return () => cancelAnimationFrame(id);
    }
  }, [skipTransition]);

  const patchDeck = useCallback(
    (body: Record<string, unknown>) => {
      if (!deck.id) return; // ephemeral "practice once" — nothing to persist
      fetch(`/api/decks/${deck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => { /* local state already updated */ });
    },
    [deck.id]
  );

  const commitSwipe = useCallback(
    (direction: "known" | "learning") => {
      const qi = qpos;
      const fullIdx = queue[qi];
      const card = cards[fullIdx];
      const newStatus = direction === "known" ? "learnt" : "in_progress";

      setCards((prev) => prev.map((c, i) => (i === fullIdx ? { ...c, status: newStatus } : c)));
      if (card?._id) patchDeck({ cardId: card._id, status: newStatus });
      patchDeck({ resumeIndex: fullIdx + 1 });

      setExitDirection(direction);
      setActiveZone(null);

      setTimeout(() => {
        setFlipped(false);
        setSkipTransition(true);
        setExitDirection(null);
        setDragX(0);
        if (qi + 1 >= queue.length) {
          patchDeck({ resumeIndex: cards.length }); // pass complete
          setFinished(true);
        } else {
          setQpos(qi + 1);
        }
      }, 380);
    },
    [qpos, queue, cards, patchDeck]
  );

  const practiceAgain = () => {
    setQueue(inProgressQueue(cards, 0));
    setQpos(0);
    setFinished(false);
    setFlipped(false);
    setDragX(0);
    patchDeck({ resumeIndex: 0 });
  };

  const reviveAll = () => {
    const revived = cards.map((c) => ({ ...c, status: "in_progress" as const }));
    setCards(revived);
    setQueue(revived.map((_, i) => i));
    setQpos(0);
    setFinished(false);
    setFlipped(false);
    setDragX(0);
    patchDeck({ revive: true });
  };

  // ── Pointer events ──────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (exitDirection) return;
    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    movedDistance.current = 0;
    setStageW(stageRef.current?.clientWidth ?? window.innerWidth);
    setDragging(true);
    sceneRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || pointerId.current !== e.pointerId) return;
    const stageWidth = stageRef.current?.clientWidth ?? window.innerWidth;
    const halfWidth = stageWidth / 2;
    let dx = e.clientX - startX.current;
    dx = Math.max(-halfWidth, Math.min(halfWidth, dx));
    movedDistance.current = Math.abs(e.clientX - startX.current);
    setDragX(dx);
    const ratio = dx / halfWidth;
    if (ratio >= ZONE_TRIGGER_RATIO) setActiveZone("known");
    else if (ratio <= -ZONE_TRIGGER_RATIO) setActiveZone("learning");
    else setActiveZone(null);
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    if (activeZone) commitSwipe(activeZone);
    else setDragX(0);
    setActiveZone(null);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    if (movedDistance.current <= TAP_MAX_MOVEMENT) {
      setDragging(false);
      setDragX(0);
      setActiveZone(null);
      setFlipped((f) => !f);
      return;
    }
    endDrag();
  };

  // ── Keyboard ────────────────────────────────────────────────
  useEffect(() => {
    if (showSummary) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (exitDirection) return;
      if (e.key === "ArrowRight") { e.preventDefault(); commitSwipe("known"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); commitSwipe("learning"); }
      else if (e.key === " ") { e.preventDefault(); setFlipped((f) => !f); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commitSwipe, exitDirection, showSummary]);

  // ── Summary screen (round complete / all learnt) ────────────
  if (showSummary) {
    const allLearnt = inProgress === 0;
    return (
      <div className={styles.finishedWrapper}>
        <div className={styles.finishedCard}>
          <div className={styles.finishedEmoji}>{allLearnt ? "🏆" : "🎉"}</div>
          <h2 className={styles.finishedTitle}>
            {allLearnt ? "All words learnt!" : "Round complete!"}
          </h2>
          <p className={styles.finishedDeckName}>{deck.name}</p>
          <div className={styles.finishedStats}>
            <div className={styles.statBox}>
              <span className={styles.statNum} data-variant="known">{learnt}</span>
              <span className={styles.statLabel}>Learnt</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statBox}>
              <span className={styles.statNum} data-variant="learning">{inProgress}</span>
              <span className={styles.statLabel}>In progress</span>
            </div>
          </div>
          <div className={styles.finishedActions}>
            {inProgress > 0 && (
              <button className={styles.btnPrimary} onClick={practiceAgain}>
                Continue practicing
              </button>
            )}
            {/* Revive is only offered once every card has been learnt */}
            {allLearnt && (
              <button className={styles.btnPrimary} onClick={reviveAll}>
                Revive all cards
              </button>
            )}
            <button className={styles.btnSecondary} onClick={onDone}>
              Back to decks
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Transform ───────────────────────────────────────────────
  const halfWidth = stageW / 2 || 1;
  const dragRatio = Math.max(-1, Math.min(1, dragX / halfWidth));
  const flyDistance = (typeof window !== "undefined" ? window.innerWidth : 1200) + 200;

  const transform = exitDirection
    ? exitDirection === "known"
      ? `translateX(${flyDistance}px) rotate(${MAX_ROTATION * 2}deg)`
      : `translateX(-${flyDistance}px) rotate(-${MAX_ROTATION * 2}deg)`
    : `translateX(${dragX}px) rotate(${dragRatio * MAX_ROTATION}deg)`;

  return (
    <div className={styles.page}>
      <button
        className={styles.exitBtn}
        onClick={onDone}
        aria-label="Exit practice"
        title="Exit practice"
      >
        ✕ Exit
      </button>

      {/* LEFT — still learning */}
      <div
        className={`${styles.sideZone} ${styles.zoneLearning} ${activeZone === "learning" ? styles.zoneActive : ""}`}
        style={{ opacity: dragRatio < 0 ? Math.min(1, -dragRatio / ZONE_TRIGGER_RATIO) * 0.5 + 0.5 : 0.18 }}
      >
        <span className={styles.zoneLabel}>Still learning</span>
      </div>

      {/* Center */}
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <div className={styles.deckMeta}>
            <span className={styles.deckName}>{deck.name}</span>
            <span className={styles.cardCount}>{qpos + 1} / {queue.length}</span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.progressLabel}>
            <span className={styles.knownLabel}>{learnt} learnt</span>
            <span className={styles.learningLabel}>{inProgress} in progress</span>
          </div>
        </div>

        <div className={styles.stage} ref={stageRef}>
          <div
            ref={sceneRef}
            className={`${styles.cardScene} ${flipped ? styles.flipped : ""} ${
              dragging || skipTransition ? styles.draggingScene : styles.settlingScene
            } ${skipTransition ? styles.noFlip : ""}`}
            data-exiting={exitDirection ? "true" : "false"}
            style={{ transform }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            role="button"
            tabIndex={0}
            aria-label={
              flipped
                ? "Card showing translation. Tap to flip back. Drag right = learnt, left = keep learning."
                : "Card showing word. Tap to flip. Drag right = learnt, left = keep learning."
            }
          >
            <div className={styles.cardInner}>
              <div className={styles.cardFace}>
                <span className={styles.cardSideLabel}>word</span>
                <span className={styles.cardText}>{current.word}</span>
                <span className={styles.cardHint}>tap to reveal</span>
              </div>
              <div className={`${styles.cardFace} ${styles.cardBack}`}>
                <span className={styles.cardSideLabel}>translation</span>
                <span className={styles.cardText}>{current.translation}</span>
                <span className={styles.cardHint}>← keep · learnt →</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — learnt */}
      <div
        className={`${styles.sideZone} ${styles.zoneKnown} ${activeZone === "known" ? styles.zoneActive : ""}`}
        style={{ opacity: dragRatio > 0 ? Math.min(1, dragRatio / ZONE_TRIGGER_RATIO) * 0.5 + 0.5 : 0.18 }}
      >
        <span className={styles.zoneLabel}>Learnt</span>
      </div>
    </div>
  );
}
