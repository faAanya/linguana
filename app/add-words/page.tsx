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

const LS_SOURCE = "addwords.sourceLang";
const LS_TARGET = "addwords.targetLang";

export default function AddWordsPage() {
  const { user } = useAuth();

  // Language selection: null override means "use the user's default". Saved
  // choices are loaded from localStorage after mount (below).
  const [sourceOverride, setSourceOverride] = useState<string | null>(null);
  const [targetOverride, setTargetOverride] = useState<string | null>(null);

  const defaultSource = user?.nativeLanguages?.[0] ?? "en";
  const defaultTarget =
    user?.learningLanguages?.[0] ??
    LANGUAGES.map((l) => l.code).find((c) => c !== defaultSource) ??
    "es";

  const sourceLang = sourceOverride ?? defaultSource;
  const targetLang = targetOverride ?? defaultTarget;

  // Load the saved language preferences once, on the client.
  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_SOURCE);
      const t = localStorage.getItem(LS_TARGET);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (s && s in LANGUAGE_MAP) setSourceOverride(s);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (t && t in LANGUAGE_MAP) setTargetOverride(t);
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
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentWord[]>([]);
  const [showAuth, setShowAuth] = useState(false);

  const translatedFor = useRef<string>("");

  const runTranslate = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!user) { setShowAuth(true); return; }

      if (sourceLang === targetLang) {
        setCandidates([trimmed]);
        setSelected(trimmed);
        translatedFor.current = trimmed;
        return;
      }

      setTranslating(true);
      setError(null);
      try {
        const res = await fetch("/api/translate/options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, sourceLang, targetLang }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Translation failed");
        }
        const { options: opts } = await res.json();
        const list: string[] = Array.isArray(opts) ? opts : [];
        setCandidates(list);
        // Pre-select the most common translation
        setSelected(list[0] ?? null);
        translatedFor.current = trimmed;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Translation failed");
      } finally {
        setTranslating(false);
      }
    },
    [sourceLang, targetLang, user]
  );

  // Auto-translate shortly after the user stops typing.
  useEffect(() => {
    const trimmed = word.trim();
    if (!trimmed || !user) return;
    if (trimmed === translatedFor.current) return;
    const t = setTimeout(() => runTranslate(trimmed), 650);
    return () => clearTimeout(t);
  }, [word, runTranslate, user]);

  const changeSource = (code: string) => {
    setSourceOverride(code);
    persist(LS_SOURCE, code);
    translatedFor.current = "";
    setCandidates([]);
    setSelected(null);
  };

  const changeTarget = (code: string) => {
    setTargetOverride(code);
    persist(LS_TARGET, code);
    translatedFor.current = "";
    setCandidates([]);
    setSelected(null);
  };

  const swap = () => {
    setSourceOverride(targetLang);
    setTargetOverride(sourceLang);
    persist(LS_SOURCE, targetLang);
    persist(LS_TARGET, sourceLang);
    setWord(selected ?? candidates[0] ?? "");
    setCandidates([]);
    setSelected(null);
    translatedFor.current = "";
  };

  // Only one translation can be chosen at a time (click again to deselect).
  const selectOption = (opt: string) => {
    setSelected((prev) => (prev === opt ? null : opt));
  };

  const handleSave = async () => {
    if (!word.trim() || !selected) return;
    if (!user) { setShowAuth(true); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.trim(), translation: selected, sourceLang, targetLang }),
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
      setCandidates([]);
      setSelected(null);
      translatedFor.current = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!word.trim() && !!selected && !saving;

  return (
    <>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Add words</h1>
          <p className={styles.subtitle}>
            Type a word, pick the translations you want, and save them to{" "}
            <Link href="/words" className={styles.inlineLink}>your collection</Link>.
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
                {!translating && candidates.length > 0 && (
                  <span className={styles.pickHint}>· pick one</span>
                )}
              </label>
              <div className={styles.optionsBox}>
                {candidates.length === 0 ? (
                  <span className={styles.optionsEmpty}>
                    {translating ? "Finding translations…" : "Translations appear here — tap the ones to save"}
                  </span>
                ) : (
                  <div className={styles.optionChips}>
                    {candidates.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`${styles.optionChip} ${selected === opt ? styles.optionChipSelected : ""}`}
                        onClick={() => selectOption(opt)}
                        aria-pressed={selected === opt}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
