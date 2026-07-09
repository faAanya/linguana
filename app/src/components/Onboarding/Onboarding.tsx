"use client";

import { useState } from "react";
import LanguagePicker from "../LanguagePicker/LanguagePicker";
import styles from "./Onboarding.module.css";

interface Props {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: Props) {
  const [nativeLanguages, setNativeLanguages] = useState<string[]>([]);
  const [learningLanguages, setLearningLanguages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = nativeLanguages.length > 0 && learningLanguages.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/languages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learningLanguages, nativeLanguages }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.emoji}>🦎</span>
          <h2 className={styles.title}>Welcome to Linguana!</h2>
          <p className={styles.subtitle}>
            Tell us which languages you speak and which you want to learn, so we
            can tailor your flashcards and translations.
          </p>
        </div>

        <LanguagePicker
          label="I speak"
          hint="your native language(s)"
          selected={nativeLanguages}
          onChange={setNativeLanguages}
        />
        <LanguagePicker
          label="I want to learn"
          hint="target language(s)"
          selected={learningLanguages}
          onChange={setLearningLanguages}
        />

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.btnSave} onClick={handleSave} disabled={!canSave || saving}>
          {saving ? (
            <span className={styles.spinner}>
              <span className={styles.spinnerDot} />
              Saving…
            </span>
          ) : (
            "Get started →"
          )}
        </button>
      </div>
    </div>
  );
}
