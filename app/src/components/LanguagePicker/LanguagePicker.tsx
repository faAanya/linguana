"use client";

import { useState } from "react";
import { LANGUAGES } from "@/app/src/lib/languages";
import styles from "./LanguagePicker.module.css";

interface Props {
  label: string;
  hint?: string;
  selected: string[];
  onChange: (codes: string[]) => void;
  // codes to disable (e.g. can't be native AND learning at once)
  disabledCodes?: string[];
}

export default function LanguagePicker({
  label,
  hint,
  selected,
  onChange,
  disabledCodes = [],
}: Props) {
  const [query, setQuery] = useState("");

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  const filtered = LANGUAGES.filter((l) =>
    l.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>

      <input
        className={styles.search}
        type="text"
        placeholder="Search languages…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className={styles.chipGrid}>
        {filtered.map((lang) => {
          const isSelected = selected.includes(lang.code);
          const isDisabled = disabledCodes.includes(lang.code) && !isSelected;
          return (
            <button
              key={lang.code}
              type="button"
              className={`${styles.chip} ${isSelected ? styles.chipSelected : ""}`}
              onClick={() => toggle(lang.code)}
              disabled={isDisabled}
              title={isDisabled ? "Already selected in the other list" : undefined}
            >
              <span className={styles.flag}>{lang.flag}</span>
              {lang.name}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className={styles.noResults}>No languages match “{query}”</p>
        )}
      </div>
    </div>
  );
}
