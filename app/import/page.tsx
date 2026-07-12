"use client";

import { useState } from "react";
import ImageUploader from "@/app/src/components/ImageUploader/ImageUploader";
import SaveDeck from "@/app/src/components/SaveDeck/SaveDeck";
import Flashcards from "@/app/src/components/FlashCards/FlashCards";
import AuthModal from "@/app/src/components/Auth/AuthModal";
import { useAuth } from "@/app/src/components/Auth/AuthContext";
import { PracticeCard, PracticeDeck } from "@/app/src/models/domain";
import styles from "./page.module.css";

type Step = "upload" | "save" | "practice";

export default function ImportPage() {
  const { user, loading } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [pendingCards, setPendingCards] = useState<PracticeCard[]>([]);
  const [activeDeck, setActiveDeck] = useState<PracticeDeck | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleConfirmed = (pairs: { word: string; translation: string }[]) => {
    setPendingCards(
      pairs.map((p) => ({
        word: p.word,
        translation: p.translation,
        status: "learning" as const,
      }))
    );

    // Gate: require login before saving
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setStep("save");
  };

  // Called after user logs in via the auth modal triggered by handleConfirmed
  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // pendingCards already set — proceed to save step
    setStep("save");
  };

  const handleSaved = (deck: PracticeDeck) => {
    setActiveDeck(deck);
    setStep("practice");
  };

  const handleDone = () => {
    setStep("upload");
    setPendingCards([]);
    setActiveDeck(null);
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <div className={styles.loadingSpinner} />
      </main>
    );
  }

  return (
    <>
      <main className={styles.main}>
        <div className={styles.header}>
          {step !== "practice" && (
            <>
              <div className={styles.badge}>
                {step === "upload" ? "Step 1 of 2" : "Step 2 of 2"}
              </div>
              <h1 className={styles.title}>Create a deck</h1>
              <p className={styles.subtitle}>
                {step === "upload"
                  ? "Import vocabulary from a photo, pasted text, a manual list, or an AI prompt"
                  : "Give your deck a name to save and start practicing"}
              </p>
            </>
          )}
        </div>

        {step === "upload" && <ImageUploader onConfirmed={handleConfirmed} />}

        {step === "save" && user && (
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

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          initialMode="login"
          onSuccess={handleAuthSuccess}
        />
      )}
    </>
  );
}
