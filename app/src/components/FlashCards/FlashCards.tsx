"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, Deck } from "@/app/src/models";
import styles from "./FlashCards.module.css";

interface Props {
  deck: Deck;
  onDone: () => void;
}

interface Props {
  deck: Deck;
  onDone: () => void;
}

const MAX_ROTATION = 10; // degrees at full drag
const TAP_MAX_MOVEMENT = 8; // px — below this, a pointerup counts as a tap not a drag
const ZONE_TRIGGER_RATIO = 0.95; // fraction of max drag distance needed to commit — must drag almost all the way to the side

export default function Flashcards({ deck, onDone }: Props) {
  const [cards, setCards] = useState<Card[]>(deck.cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);

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
  const known = cards.filter((c) => c.status === "known").length;
  const progress = Math.round((known / cards.length) * 100);

  // Lock page scroll while this view is mounted (static page, no scroll-fighting with drag)
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const persistStatus = (cardIndex: number, status: Card["status"]) => {
    fetch(`/api/decks/${deck.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardIndex, status }),
    }).catch(() => {
      /* silently fail — local state already updated */
    });
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
        setDragX(0);
        setExitDirection(null);
        setFlipped(false);
        if (cardIndex + 1 >= cards.length) {
          setFinished(true);
        } else {
          setIndex(cardIndex + 1);
        }
      }, 260);
    },
    [index, cards.length, deck.id]
  );

  // ── Pointer (mouse + touch) drag handling ──────────────────
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
    // Clamp drag so the card can never leave the visible viewport
    dx = Math.max(-halfWidth, Math.min(halfWidth, dx));

    movedDistance.current = Math.abs(e.clientX - startX.current);
    setDragX(dx);

    const ratio = dx / halfWidth;
    if (ratio >= ZONE_TRIGGER_RATIO) {
      setActiveZone("known");
    } else if (ratio <= -ZONE_TRIGGER_RATIO) {
      setActiveZone("learning");
    } else {
      setActiveZone(null);
    }
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);

    if (activeZone) {
      commitSwipe(activeZone);
    } else {
      setDragX(0);
    }
    setActiveZone(null);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;

    // Tap (no meaningful drag) -> flip. Real drag -> resolve via endDrag.
    if (movedDistance.current <= TAP_MAX_MOVEMENT) {
      setDragging(false);
      setDragX(0);
      setActiveZone(null);
      setFlipped((f) => !f);
      return;
    }

    endDrag();
  };

  // ── Keyboard support (desktop) ──────────────────────────────
  useEffect(() => {
    if (finished) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (exitDirection) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        commitSwipe("known");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        commitSwipe("learning");
      } else if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commitSwipe, exitDirection, finished]);

  if (finished) {
    const knownFinal = cards.filter((c) => c.status === "known").length;
    const learningFinal = cards.length - knownFinal;

    return (
      <div className={styles.finishedWrapper}>
        <div className={styles.finishedCard}>
          <div className={styles.finishedEmoji}>🎉</div>
          <h2 className={styles.finishedTitle}>Round complete!</h2>
          <p className={styles.finishedDeckName}>{deck.name}</p>

          <div className={styles.finishedStats}>
            <div className={styles.statBox}>
              <span className={styles.statNum} data-variant="known">{knownFinal}</span>
              <span className={styles.statLabel}>Known</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statBox}>
              <span className={styles.statNum} data-variant="learning">{learningFinal}</span>
              <span className={styles.statLabel}>Still learning</span>
            </div>
          </div>

          <div className={styles.finishedActions}>
            {learningFinal > 0 && (
              <button
                className={styles.btnPrimary}
                onClick={() => {
                  setIndex(0);
                  setFlipped(false);
                  setFinished(false);
                }}
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

  const stageWidth = stageRef.current?.clientWidth ?? 0;
  const halfWidth = stageWidth / 2 || 1;
  const dragRatio = Math.max(-1, Math.min(1, dragX / halfWidth));

  const transform = exitDirection
    ? exitDirection === "known"
      ? `translateX(${halfWidth}px) rotate(${MAX_ROTATION}deg)`
      : `translateX(-${halfWidth}px) rotate(-${MAX_ROTATION}deg)`
    : `translateX(${dragX}px) rotate(${dragRatio * MAX_ROTATION}deg)`;

  return (
    <div className={styles.page}>
      {/* LEFT side zone — drag here to mark "still learning" */}
      <div
        className={`${styles.sideZone} ${styles.zoneLearning} ${
          activeZone === "learning" ? styles.zoneActive : ""
        }`}
        style={{ opacity: dragRatio < 0 ? Math.min(1, -dragRatio / ZONE_TRIGGER_RATIO) * 0.5 + 0.5 : 0.18 }}
      >
        <span className={styles.zoneLabel}>Still learning</span>
      </div>

      {/* Centered content column — card always stays here, dead center */}
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <div className={styles.deckMeta}>
            <span className={styles.deckName}>{deck.name}</span>
            <span className={styles.cardCount}>
              {index + 1} / {cards.length}
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.progressLabel}>
            <span className={styles.knownLabel}>{known} known</span>
            <span className={styles.learningLabel}>{cards.length - known} learning</span>
          </div>
        </div>

        <div className={styles.stage} ref={stageRef}>
          <div
            ref={sceneRef}
            className={`${styles.cardScene} ${flipped ? styles.flipped : ""} ${
              dragging ? styles.draggingScene : styles.settlingScene
            }`}
            style={{ transform }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            role="button"
            tabIndex={0}
            aria-label={
              flipped
                ? "Card showing translation. Tap to flip back. Drag to the side to mark known or still learning."
                : "Card showing word. Tap to flip. Drag to the side to mark known or still learning."
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

      {/* RIGHT side zone — drag here to mark "known" */}
      <div
        className={`${styles.sideZone} ${styles.zoneKnown} ${
          activeZone === "known" ? styles.zoneActive : ""
        }`}
        style={{ opacity: dragRatio > 0 ? Math.min(1, dragRatio / ZONE_TRIGGER_RATIO) * 0.5 + 0.5 : 0.18 }}
      >
        <span className={styles.zoneLabel}>Known</span>
      </div>
    </div>
  );
}
