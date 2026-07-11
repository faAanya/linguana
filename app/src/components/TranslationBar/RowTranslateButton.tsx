"use client";

import { useState } from "react";
import styles from "./RowTranslateButton.module.css";

interface Props {
  word: string;
  sourceLang: string;
  targetLang: string;
  onTranslated: (translation: string) => void;
  disabled?: boolean;
}

// A small button placed inside a pair row. Translates just that row's word
// into the currently-selected target language and calls back with the result.
export default function RowTranslateButton({
  word,
  sourceLang,
  targetLang,
  onTranslated,
  disabled,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!word.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ text: word }],
          sourceLang,
          targetLang,
        }),
      });
      if (!res.ok) return;
      const { translations } = await res.json();
      const t = translations?.[0]?.translation;
      if (t) onTranslated(t);
    } catch {
      /* silent — user can retry */
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={handleClick}
      disabled={disabled || loading || !word.trim()}
      title="Translate this word"
      aria-label="Translate this word"
    >
      {loading ? (
        <span className={styles.spinnerDot} />
      ) : (
        // translate / language icon
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h6M5 3v1c0 2.5-1.5 4.5-3.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M3.5 6.5c.5 1.5 2 3 4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M9 14l2.5-6 2.5 6M9.8 12h3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}
