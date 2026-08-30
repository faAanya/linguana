"use client";

import { useEffect, useMemo, useState } from "react";
import type { Language } from "@/app/src/models/languages";
import Link from "next/link";
import { useAuth } from "@/app/src/components/Auth/AuthContext";
import AuthModal from "@/app/src/components/Auth/AuthModal";
import Button from "@/app/src/components/common/Button/Button";
import { LANGUAGES, LANGUAGE_MAP } from "@/app/src/models/languages";
import styles from "./page.module.css";

interface RecentWord {
  id: string;
  word: string;
  translation: string;
  targetLanguage: string;
}

const LS_SOURCE = "addwords.sourceLang";
const LS_TARGET = "addwords.targetLang";

export default function AddWordsPage() {
  const { user } = useAuth();

  // Language selection: null override means "use the user's default".
  const [sourceOverride, setSourceOverride] = useState<string | null>(null);
  const [targetOverride, setTargetOverride] = useState<string | null>(null);

  const defaultSource = user?.nativeLanguages?.[0] ?? "en";
  const defaultTarget =
    user?.learningLanguages?.[0] ??
    LANGUAGES.map((l) => l.code).find((c) => c !== defaultSource) ??
    "es";

  const sourceLang = sourceOverride ?? defaultSource;
  const targetLang = targetOverride ?? defaultTarget;
  const nativeLang = user?.nativeLanguages?.[0] ?? defaultSource;

  // Load the saved language preferences once, on the client.
  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_SOURCE);
      const t = localStorage.getItem(LS_TARGET);
      /* eslint-disable react-hooks/set-state-in-effect -- one-time read of a saved preference */
      if (s && s in LANGUAGE_MAP) setSourceOverride(s);
      if (t && t in LANGUAGE_MAP) setTargetOverride(t);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      /* localStorage unavailable — fall back to defaults */
    }
  }, []);

  const persist = (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  };

  const options: Language[] = useMemo(() => {
    const own = [...(user?.nativeLanguages ?? []), ...(user?.learningLanguages ?? [])];
    const ownUnique = [...new Set(own)].filter((c) => c in LANGUAGE_MAP);
    const rest = LANGUAGES.map((l) => l.code).filter((c) => !ownUnique.includes(c));
    return [...ownUnique, ...rest].map((c) => LANGUAGE_MAP[c]);
  }, [user]);

  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState(""); // the single value in the box
  const [candidates, setCandidates] = useState<string[]>([]); // alternatives below
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentWord[]>([]);
  const [showAuth, setShowAuth] = useState(false);

  // Fetch translations ONLY when the user asks (they may not know the word).
  const runTranslate = async () => {
    const trimmed = word.trim();
    if (!trimmed) return;
    if (!user) { setShowAuth(true); return; }

    if (sourceLang === targetLang) {
      setTranslation(trimmed);
      setCandidates([]);
      return;
    }

    setTranslating(true);
    setError(null);
    try {
      const res = await fetch("/api/translate/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, sourceLang, targetLang, nativeLang }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Translation failed");
      }
      const { options: opts } = await res.json();
      const list: string[] = Array.isArray(opts) ? opts : [];
      setCandidates(list);
      // Put the single best translation in the box; the rest stay as options.
      if (list[0]) setTranslation(list[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setTranslating(false);
    }
  };

  const changeSource = (code: string) => {
    setSourceOverride(code);
    persist(LS_SOURCE, code);
    setCandidates([]);
  };

  const changeTarget = (code: string) => {
    setTargetOverride(code);
    persist(LS_TARGET, code);
    setTranslation("");
    setCandidates([]);
  };

  const swap = () => {
    setSourceOverride(targetLang);
    setTargetOverride(sourceLang);
    persist(LS_SOURCE, targetLang);
    persist(LS_TARGET, sourceLang);
    setWord(translation);
    setTranslation(word);
    setCandidates([]);
  };

  const handleSave = async () => {
    if (!word.trim() || !translation.trim()) return;
    if (!user) { setShowAuth(true); return; }

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
      const s = await res.json();

      setRecent((prev) => [
        { id: s.id, word: s.word, translation: s.translation, targetLanguage: s.targetLanguage },
        ...prev.filter((r) => r.id !== s.id),
      ]);

      setWord("");
      setTranslation("");
      setCandidates([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!word.trim() && !!translation.trim() && !saving;
  // Options that aren't already the chosen translation
  const otherOptions = candidates.filter((c) => c !== translation);

  return (
    <>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Add words</h1>
          <p className={styles.subtitle}>
            Type a word and its translation — or press Translate if you don&rsquo;t know it —
            then save it to <Link href="/words" className={styles.inlineLink}>your collection</Link>.
          </p>
        </div>

        <div className={styles.translator}>
          <div className={styles.langRow}>
            <select
              className={styles.langSelect}
              value={sourceLang}
              onChange={(e) => changeSource(e.target.value)}
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
              onChange={(e) => changeTarget(e.target.value)}
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
                  if (e.key === "Enter") { e.preventDefault(); runTranslate(); }
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
                placeholder="Type the translation, or press Translate"
                rows={3}
                maxLength={120}
              />
            </div>
          </div>

          {/* Alternative translations — click one to put it in the box */}
          {otherOptions.length > 0 && (
            <div className={styles.options}>
              <span className={styles.optionsLabel}>Other translations</span>
              <div className={styles.optionChips}>
                {otherOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={styles.optionChip}
                    onClick={() => setTranslation(opt)}
                    title="Use this translation"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={runTranslate}
              disabled={!word.trim() || translating}
            >
              {translating ? "Translating…" : "Translate"}
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!canSave}>
              {saving ? "Saving…" : "＋ Save word"}
            </Button>
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
