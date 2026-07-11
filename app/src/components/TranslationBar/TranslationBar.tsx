"use client";

import { useState } from "react";
import { useAuth } from "../Auth/AuthContext";
import { LANGUAGE_MAP } from "@/app/src/models/languages";
import styles from "./TranslationBar.module.css";

interface Row {
  key: string;
  word: string;
  translation: string;
}

interface Props {
  rows: Row[];
  sourceLang?: string;
  targetLang: string;
  onTargetLangChange: (code: string) => void;
  onTranslated: (updated: Row[]) => void;
}

export default function TranslationBar({
  rows, sourceLang = "en", targetLang, onTargetLangChange, onTranslated,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Offer the user's learning languages first, fall back to all
const codes = [
  ...(user?.nativeLanguages ?? []),
  ...(user?.learningLanguages ?? []),
];
const uniqueCodes = [...new Set(codes)];
const options = (uniqueCodes.length
  ? uniqueCodes
  : Object.keys(LANGUAGE_MAP)
).map((code) => LANGUAGE_MAP[code]).filter(Boolean);

  const handleTranslateAll = async () => {
    const toTranslate = rows.filter((r) => r.word.trim());
    if (toTranslate.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: toTranslate.map((r) => ({ text: r.word })),
          sourceLang,
          targetLang,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Translation failed");
      }

      const { translations } = await res.json();

      // Map results back to rows by matching order of toTranslate
      const translationByWord = new Map<string, string>();
      translations.forEach((t: { text: string; translation: string }) => {
        translationByWord.set(t.text, t.translation);
      });

      const updated = rows.map((r) =>
        translationByWord.has(r.word)
          ? { ...r, translation: translationByWord.get(r.word)! }
          : r
      );

      onTranslated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.bar}>
      <div className={styles.controls}>
        <span className={styles.label}>Translate all to</span>
        <select
          className={styles.select}
          value={targetLang}
          onChange={(e) => onTargetLangChange(e.target.value)}
        >
          {options.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.btnTranslate}
          onClick={handleTranslateAll}
          disabled={loading}
        >
          {loading ? (
            <span className={styles.spinner}>
              <span className={styles.spinnerDot} />
              Translating…
            </span>
          ) : (
            "Translate all"
          )}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
