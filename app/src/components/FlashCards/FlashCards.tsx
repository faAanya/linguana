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

export default function Flashcards({ deck, onDone }: Props) {
  const [cards, setCards] = useState<PracticeCard[]>(deck.cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [skipTransition, setSkipTransition] = useState(false);

  // Drag state
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [activeZone, setActiveZone] = useState<"known" | "learning" | null>(null);
  const [exitDirection, setExitDirection] = useState<"known" | "learning" | null>(null);

  const startX = useRef(0);
  const pointerId = useRef<number | null>(null);
  const movedDistance = useRef(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const current = cards[index];

  // Progress = cards swiped so far (regardless of direction)
  const known = cards.filter((c) => c.status === "known").length;
  const learning = cards.filter((c) => c.status === "learning").length;
  const reviewed = index;
  const progress = Math.round((reviewed / cards.length) * 100);

  // Lock page scroll during practice
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  // Re-enable transition one frame after a card swap (prevents reverse-fly animation)
  useEffect(() => {
    if (skipTransition) {
      const id = requestAnimationFrame(() => setSkipTransition(false));
      return () => cancelAnimationFrame(id);
    }
  }, [skipTransition]);

  const persistStatus = (cardIndex: number, status: PracticeCard["status"]) => {
    fetch(`/api/decks/${deck.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardIndex, status }),
    }).catch(() => { /* silently fail — local state already updated */ });
  };

  const commitSwipe = useCallback(
    (direction: "known" | "learning") => {
      const cardIndex = index;
      setCards((prev) =>
        prev.map((c, i) => (i === cardIndex ? { ...c, status: direction } : c))
      );
      persistStatus(cardIndex, direction);
      setExitDirection(direction);
      setActiveZone(null);

      setTimeout(() => {
        setFlipped(false);
        setSkipTransition(true);
        setExitDirection(null);
        setDragX(0);
        if (cardIndex + 1 >= cards.length) {
          setFinished(true);
        } else {
          setIndex(cardIndex + 1);
        }
      }, 380);
    },
    [index, cards.length, deck.id]
  );

  // ── Pointer events ──────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (exitDirection) return;
    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    movedDistance.current = 0;
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
    if (finished) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (exitDirection) return;
      if (e.key === "ArrowRight") { e.preventDefault(); commitSwipe("known"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); commitSwipe("learning"); }
      else if (e.key === " ") { e.preventDefault(); setFlipped((f) => !f); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commitSwipe, exitDirection, finished]);

  // ── Finished screen ─────────────────────────────────────────
  if (finished) {
    return (
      <div className={styles.finishedWrapper}>
        <div className={styles.finishedCard}>
          <div className={styles.finishedEmoji}>🎉</div>
          <h2 className={styles.finishedTitle}>Round complete!</h2>
          <p className={styles.finishedDeckName}>{deck.name}</p>
          <div className={styles.finishedStats}>
            <div className={styles.statBox}>
              <span className={styles.statNum} data-variant="known">{known}</span>
              <span className={styles.statLabel}>Known</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statBox}>
              <span className={styles.statNum} data-variant="learning">{learning}</span>
              <span className={styles.statLabel}>Still learning</span>
            </div>
          </div>
          <div className={styles.finishedActions}>
            {learning > 0 && (
              <button
                className={styles.btnPrimary}
                onClick={() => { setIndex(0); setFlipped(false); setFinished(false); }}
              >
                Practice again
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
  const stageWidth = stageRef.current?.clientWidth ?? 0;
  const halfWidth = stageWidth / 2 || 1;
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
            <span className={styles.cardCount}>{index + 1} / {cards.length}</span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.progressLabel}>
            <span className={styles.knownLabel}>{known} known</span>
            <span className={styles.learningLabel}>{learning} learning</span>
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
                ? "Card showing translation. Tap to flip back. Drag to the side to mark."
                : "Card showing word. Tap to flip. Drag to a side to mark."
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
                <span className={styles.cardHint}>drag to a side</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — known */}
      <div
        className={`${styles.sideZone} ${styles.zoneKnown} ${activeZone === "known" ? styles.zoneActive : ""}`}
        style={{ opacity: dragRatio > 0 ? Math.min(1, dragRatio / ZONE_TRIGGER_RATIO) * 0.5 + 0.5 : 0.18 }}
      >
        <span className={styles.zoneLabel}>Known</span>
      </div>
    </div>
  );
}