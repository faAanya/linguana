"use client";

import { useState } from "react";
import ImageUploader from "./src/components/ImageUploader/ImageUploader";
import SaveDeck from "./src/components/SaveDeck/SaveDeck";
import Flashcards from "./src/components/FlashCards/FlashCards";
import { Card, Deck } from "@/app/src/models/index";
import styles from "./page.module.css";

type Step = "upload" | "save" | "practice";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [pendingCards, setPendingCards] = useState<Card[]>([]);
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);

  const handleConfirmed = (pairs: { word: string; translation: string }[]) => {
    setPendingCards(
      pairs.map((p) => ({ word: p.word, translation: p.translation, status: "learning" }))
    );
    setStep("save");
  };

  const handleSaved = (deck: Deck) => {
    setActiveDeck(deck);
    setStep("practice");
  };

  const handleDone = () => {
    setStep("upload");
    setPendingCards([]);
    setActiveDeck(null);
  };

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        {step !== "practice" && (
          <>
            <div className={styles.badge}>
              {step === "upload" ? "Step 1 of 2" : "Step 2 of 2"}
            </div>
            <h1 className={styles.title}>LinguaFlash</h1>
            <p className={styles.subtitle}>
              {step === "upload"
                ? "Upload a photo of your vocabulary notes to get started"
                : "Give your deck a name to save and start practicing"}
            </p>
          </>
        )}
        {step === "practice" && activeDeck && (
          <h1 className={styles.title}>LinguaFlash</h1>
        )}
      </div>

      {step === "upload" && <ImageUploader onConfirmed={handleConfirmed} />}

      {step === "save" && (
        <SaveDeck
          cards={pendingCards}
          onSaved={handleSaved}
          onBack={() => setStep("upload")}
        />
      )}

      {step === "practice" && activeDeck && (
        <Flashcards deck={activeDeck} onDone={handleDone} />
      )}
    </main>
  );
}
