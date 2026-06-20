"use client";

import { useCallback, useState } from "react";
import styles from "./ImageUploader.module.css";

interface WordPair {
  word: string;
  translation: string;
}

interface ExtractionResult {
  pairs: WordPair[];
  rawText: string;
}

interface Props {
  onConfirmed: (pairs: WordPair[]) => void;
}

export default function ImageUploader({ onConfirmed }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editedRaw, setEditedRaw] = useState<string>("");

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WEBP).");
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/llm/extract-words", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Extraction failed");
      }

      const data: ExtractionResult = await res.json();
      setResult(data);
      setEditedRaw(data.rawText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!result) return;
    onConfirmed(result.pairs);
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setEditedRaw("");
  };

  return (
    <div className={styles.wrapper}>
      {/* Upload zone */}
      {!preview && (
        <label
          className={`${styles.dropzone} ${dragOver ? styles.dragOver : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            onChange={onInputChange}
          />
          <div className={styles.dropzoneIcon}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M4 30l10-10 8 8 6-6 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="34" cy="18" r="3" fill="currentColor" />
            </svg>
          </div>
          <p className={styles.dropzoneTitle}>Drop your vocabulary image here</p>
          <p className={styles.dropzoneSubtitle}>or click to browse — JPG, PNG, WEBP supported</p>
        </label>
      )}

      {/* Preview + extract */}
      {preview && !result && (
        <div className={styles.previewSection}>
          <div className={styles.previewCard}>
            <img src={preview} alt="Uploaded vocabulary" className={styles.previewImg} />
          </div>
          <div className={styles.previewActions}>
            <button className={styles.btnSecondary} onClick={handleReset} disabled={loading}>
              Choose different image
            </button>
            <button className={styles.btnPrimary} onClick={handleExtract} disabled={loading}>
              {loading ? (
                <span className={styles.spinner}>
                  <span className={styles.spinnerDot} />
                  Reading image…
                </span>
              ) : (
                "Extract words"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className={styles.errorBox}><strong>Error:</strong> {error}</div>}

      {/* Result review */}
      {result && (
        <div className={styles.resultSection}>
          <div className={styles.resultColumns}>
            <div className={styles.resultImageCol}>
              <p className={styles.colLabel}>Your image</p>
              <img src={preview!} alt="Uploaded" className={styles.resultImg} />
            </div>
            <div className={styles.resultTextCol}>
              <p className={styles.colLabel}>
                What the model read{" "}
                <span className={styles.colLabelHint}>— edit if needed</span>
              </p>
              <textarea
                className={styles.rawTextArea}
                value={editedRaw}
                onChange={(e) => setEditedRaw(e.target.value)}
                rows={Math.max(result.pairs.length + 2, 6)}
              />
              <p className={styles.colLabel} style={{ marginTop: "1.25rem" }}>
                Extracted pairs{" "}
                <span className={styles.pairsCount}>{result.pairs.length} found</span>
              </p>
              <ul className={styles.pairsList}>
                {result.pairs.map((p, i) => (
                  <li key={i} className={styles.pairItem}>
                    <span className={styles.pairWord}>{p.word}</span>
                    <span className={styles.pairSep}>→</span>
                    <span className={styles.pairTranslation}>{p.translation}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className={styles.resultActions}>
            <button className={styles.btnSecondary} onClick={handleReset}>Start over</button>
            <button className={styles.btnSuccess} onClick={handleConfirm} disabled={result.pairs.length === 0}>
              Looks correct — create flashcards →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}