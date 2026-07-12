"use client";

import { useState } from "react";
import { PracticeDeck } from "@/app/src/models/domain";
import styles from "./PracticeLauncher.module.css";
import Flashcards from "../FlashCards/FlashCards";
import ExtendedPractice from "./ExtendedPractice";

interface Props {
  deck: PracticeDeck;
  onDone: () => void;
}

type Mode = "select" | "general" | "extended";

export default function PracticeLauncher({ deck, onDone }: Props) {
  const [mode, setMode] = useState<Mode>("select");

  if (mode === "general") {
    return <Flashcards deck={deck} onDone={onDone} />;
  }

  if (mode === "extended") {
    return <ExtendedPractice deck={deck} onDone={onDone} />;
  }

  // ── Mode selection screen ────────────────────────────────
  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h2 className={styles.title}>Choose a practice mode</h2>
        <p className={styles.subtitle}>{deck.name} · {deck.cards.length} words</p>

        <div className={styles.modes}>
          <button className={styles.modeCard} onClick={() => setMode("general")}>
            <span className={styles.modeIcon}>🃏</span>
            <span className={styles.modeName}>General</span>
            <span className={styles.modeDesc}>
              Swipe through your words. Mark each as known or still learning.
            </span>
          </button>

          <button className={styles.modeCard} onClick={() => setMode("extended")}>
            <span className={styles.modeIcon}>📝</span>
            <span className={styles.modeName}>Extended</span>
            <span className={styles.modeDesc}>
              Practice each word inside AI-generated example sentences.
            </span>
          </button>
        </div>

        <button className={styles.cancelBtn} onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}
