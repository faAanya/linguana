"use client";

import { useState } from "react";
import styles from "./PromptGenerator.module.css";

interface Props {
  // Called with generated pairs; parent decides how to merge into rows
  onGenerated: (pairs: { word: string; translation: string }[]) => void;
}

export default function PromptGenerator({ onGenerated }: Props) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Generation failed");
      }
      const data = await res.json();
      if (!data.pairs?.length) {
        setError("No words generated — try rephrasing your request.");
        return;
      }
      onGenerated(data.pairs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          type="text"
          placeholder='e.g. "20 names of plants in English"'
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
        />
        <button
          type="button"
          className={styles.btnGenerate}
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
        >
          {loading ? (
            <span className={styles.spinner}>
              <span className={styles.spinnerDot} />
              Generating…
            </span>
          ) : (
            "✨ Generate"
          )}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <p className={styles.hint}>
        Generated words are added below. Translate them with the tools below.
      </p>
    </div>
  );
}
