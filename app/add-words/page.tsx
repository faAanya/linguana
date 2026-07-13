"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "@/app/src/models/languages";
import Link from "next/link";
import { useAuth } from "@/app/src/components/Auth/AuthContext";
import AuthModal from "@/app/src/components/Auth/AuthModal";
import { LANGUAGES, LANGUAGE_MAP } from "@/app/src/models/languages";
import styles from "./page.module.css";

interface RecentWord {
  id: string;
  word: string;
  translation: string;
  targetLanguage: string;
}

export default function AddWordsPage() {
  const { user } = useAuth();

  // Language selection: null override means "use the user's default".
  // Deriving the default during render (instead of syncing via an effect)
  // keeps the dropdowns correct as soon as the user's languages load.
  const [sourceOverride, setSourceOverride] = useState<string | null>(null);
  const [targetOverride, setTargetOverride] = useState<string | null>(null);

  const defaultSource = user?.nativeLanguages?.[0] ?? "en";
  const defaultTarget =
    user?.learningLanguages?.[0] ??
    LANGUAGES.map((l) => l.code).find((c) => c !== defaultSource) ??
    "es";

  const sourceLang = sourceOverride ?? defaultSource;
  const targetLang = targetOverride ?? defaultTarget;

  // Order the dropdown so the user's own languages come first.
  const options: Language[] = useMemo(() => {
    const own = [
      ...(user?.nativeLanguages ?? []),
      ...(user?.learningLanguages ?? []),
    ];
    const ownUnique = [...new Set(own)].filter((c) => c in LANGUAGE_MAP);
    const rest = LANGUAGES.map((l) => l.code).filter((c) => !ownUnique.includes(c));
    return [...ownUnique, ...rest].map((c) => LANGUAGE_MAP[c]);
  }, [user]);

  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentWord[]>([]);
  const [showAuth, setShowAuth] = useState(false);

  // The translation is stale whenever the source word changes; track what
  // text a translation belongs to so we don't save a mismatched pair.
  const translatedFor = useRef<string>("");

  const runTranslate = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!user) {
        setShowAuth(true);
        return;
      }
      if (sourceLang === targetLang) {
        setTranslation(trimmed);
        translatedFor.current = trimmed;
        return;
      }
      setTranslating(true);
      setError(null);
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [{ text: trimmed }], sourceLang, targetLang }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Translation failed");
        }
        const { translations } = await res.json();
        const result = translations?.[0]?.translation ?? "";
        setTranslation(result);
        translatedFor.current = trimmed;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Translation failed");
      } finally {
        setTranslating(false);
      }
    },
    [sourceLang, targetLang, user]
  );

  // Auto-translate a short moment after the user stops typing.
  useEffect(() => {
    const trimmed = word.trim();
    if (!trimmed || !user) return;
    if (trimmed === translatedFor.current) return;
    const t = setTimeout(() => runTranslate(trimmed), 650);
    return () => clearTimeout(t);
  }, [word, runTranslate, user]);

  const swap = () => {
    setSourceOverride(targetLang);
    setTargetOverride(sourceLang);
    setWord(translation);
    setTranslation(word);
    translatedFor.current = "";
  };

  const handleSave = async () => {
    if (!word.trim() || !translation.trim()) return;
    if (!user) {
      setShowAuth(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: word.trim(),
          translation: translation.trim(),
          sourceLang,
          targetLang,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      const saved = await res.json();
      setRecent((prev) => [
        { id: saved.id, word: saved.word, translation: saved.translation, targetLanguage: saved.targetLanguage },
        ...prev.filter((r) => r.id !== saved.id),
      ]);
      setWord("");
      setTranslation("");
      translatedFor.current = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!word.trim() && !!translation.trim() && !saving;

  return (
    <>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Add words</h1>
          <p className={styles.subtitle}>
            Type a word, translate it into a language you&rsquo;re learning, and save it
            to <Link href="/words" className={styles.inlineLink}>your collection</Link>.
          </p>
        </div>

        <div className={styles.translator}>
          <div className={styles.langRow}>
            <select
              className={styles.langSelect}
              value={sourceLang}
              onChange={(e) => { setSourceOverride(e.target.value); translatedFor.current = ""; }}
              aria-label="Translate from"
            >
              {options.map((l) => (
                <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
              ))}
            </select>

            <button className={styles.swapBtn} onClick={swap} title="Swap languages" aria-label="Swap languages">
              ⇄
            </button>

            <select
              className={styles.langSelect}
              value={targetLang}
              onChange={(e) => { setTargetOverride(e.target.value); translatedFor.current = ""; }}
              aria-label="Translate to"
            >
              {options.map((l) => (
                <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.panes}>
            <div className={styles.pane}>
              <label className={styles.paneLabel}>{LANGUAGE_MAP[sourceLang]?.name ?? sourceLang}</label>
              <textarea
                className={styles.textarea}
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); runTranslate(word); }
                }}
                placeholder="Enter a word or phrase…"
                rows={3}
                autoFocus
                maxLength={120}
              />
            </div>

            <div className={styles.pane}>
              <label className={styles.paneLabel}>
                {LANGUAGE_MAP[targetLang]?.name ?? targetLang}
                {translating && <span className={styles.translatingDot}>· translating…</span>}
              </label>
              <textarea
                className={`${styles.textarea} ${styles.textareaOut}`}
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                placeholder="Translation appears here — edit if needed"
                rows={3}
                maxLength={120}
              />
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button
              className={styles.btnSecondary}
              onClick={() => runTranslate(word)}
              disabled={!word.trim() || translating}
            >
              {translating ? "Translating…" : "Translate"}
            </button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={!canSave}>
              {saving ? "Saving…" : "＋ Save word"}
            </button>
          </div>
        </div>

        {recent.length > 0 && (
          <div className={styles.recent}>
            <div className={styles.recentHead}>
              <span className={styles.recentTitle}>Added this session</span>
              <Link href="/words" className={styles.recentLink}>View all →</Link>
            </div>
            <ul className={styles.recentList}>
              {recent.map((r) => (
                <li key={r.id} className={styles.recentItem}>
                  <span className={styles.recentWord}>{r.word}</span>
                  <span className={styles.recentArrow}>→</span>
                  <span className={styles.recentTranslation}>{r.translation}</span>
                  <span className={styles.recentFlag}>{LANGUAGE_MAP[r.targetLanguage]?.flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          initialMode="login"
          onSuccess={() => setShowAuth(false)}
        />
      )}
    </>
  );
}
