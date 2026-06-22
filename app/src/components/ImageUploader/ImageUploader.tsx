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

interface EditableRow extends WordPair {
  key: string;
}

type InputMode = "image" | "text" | "manual";

let rowKeyCounter = 0;
const nextRowKey = () => `row-${++rowKeyCounter}-${Date.now()}`;

export default function ImageUploader({ onConfirmed }: Props) {
  const [mode, setMode] = useState<InputMode>("image");

  // Image mode state
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // Text mode state
  const [textInput, setTextInput] = useState("");

  // Shared state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editedRaw, setEditedRaw] = useState<string>("");
  const [rows, setRows] = useState<EditableRow[]>([]);

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

  const switchMode = (next: InputMode) => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setResult(null);
    setRows(next === "manual" ? [{ key: nextRowKey(), word: "", translation: "" }] : []);
  };

  const handleExtractImage = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/extract-words", {
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
      setRows(data.pairs.map((p) => ({ ...p, key: nextRowKey() })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleExtractText = async () => {
    if (!textInput.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/extract-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textInput }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Extraction failed");
      }

      const data: ExtractionResult = await res.json();
      setResult(data);
      setEditedRaw(data.rawText);
      setRows(data.pairs.map((p) => ({ ...p, key: nextRowKey() })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (key: string, field: "word" | "translation", value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  };

  const deleteRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { key: nextRowKey(), word: "", translation: "" }]);
  };

  const validRows = rows.filter((r) => r.word.trim() && r.translation.trim());

  const handleConfirm = () => {
    if (validRows.length === 0) return;
    onConfirmed(validRows.map(({ word, translation }) => ({ word, translation })));
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setTextInput("");
    setResult(null);
    setError(null);
    setEditedRaw("");
    setRows(mode === "manual" ? [{ key: nextRowKey(), word: "", translation: "" }] : []);
  };

  return (
    <div className={styles.wrapper}>
      {/* Mode switcher — iOS-style segmented slider */}
      {!result && (
        <div className={styles.segmentedControl} role="tablist" aria-label="Input type">
          <div
            className={styles.segmentedThumb}
            style={{
              transform:
                mode === "text"
                  ? "translateX(100%)"
                  : mode === "manual"
                  ? "translateX(200%)"
                  : "translateX(0%)",
            }}
          />
          <button
            type="button"
            role="tab"
            aria-selected={mode === "image"}
            className={`${styles.segmentedOption} ${mode === "image" ? styles.segmentedOptionActive : ""}`}
            onClick={() => switchMode("image")}
          >
            Image
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "text"}
            className={`${styles.segmentedOption} ${mode === "text" ? styles.segmentedOptionActive : ""}`}
            onClick={() => switchMode("text")}
          >
            Text
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "manual"}
            className={`${styles.segmentedOption} ${mode === "manual" ? styles.segmentedOptionActive : ""}`}
            onClick={() => switchMode("manual")}
          >
            Manual
          </button>
        </div>
      )}

      {/* ── IMAGE MODE ──────────────────────────────────────── */}
      {mode === "image" && !result && !preview && (
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

      {mode === "image" && !result && preview && (
        <div className={styles.previewSection}>
          <div className={styles.previewRow}>
            <img src={preview} alt="Uploaded vocabulary" className={styles.previewThumb} />
            <span className={styles.previewFileName}>{file?.name}</span>
            <button
              type="button"
              className={styles.previewRemoveBtn}
              onClick={handleReset}
              disabled={loading}
              title="Choose different image"
              aria-label="Choose different image"
            >
              ×
            </button>
          </div>
          <div className={styles.previewActions}>
            <button className={styles.btnPrimary} onClick={handleExtractImage} disabled={loading}>
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

      {/* ── TEXT MODE ───────────────────────────────────────── */}
      {mode === "text" && !result && (
        <div className={styles.previewSection}>
          <textarea
            className={styles.textModeArea}
            placeholder={"Paste your text here — either a list like:\nbonjour - hello\nmerci - thank you\n\n...or any free-form text containing vocabulary."}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            rows={10}
          />
          <div className={styles.previewActions}>
            <button className={styles.btnPrimary} onClick={handleExtractText} disabled={loading || !textInput.trim()}>
              {loading ? (
                <span className={styles.spinner}>
                  <span className={styles.spinnerDot} />
                  Reading text…
                </span>
              ) : (
                "Extract words"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── MANUAL MODE ─────────────────────────────────────── */}
      {mode === "manual" && (
        <div className={styles.resultSection}>
          <div className={styles.manualHeader}>
            <p className={styles.colLabel}>
              Flashcard pairs{" "}
              <span className={styles.pairsCount}>{validRows.length} ready</span>
            </p>
          </div>

          <div className={styles.pairsEditList}>
            {rows.map((row) => (
              <div key={row.key} className={styles.pairEditRow}>
                <input
                  className={styles.pairInput}
                  type="text"
                  value={row.word}
                  placeholder="word"
                  onChange={(e) => updateRow(row.key, "word", e.target.value)}
                  autoFocus={rows.length === 1 && !row.word && !row.translation}
                />
                <span className={styles.pairSep}>→</span>
                <input
                  className={styles.pairInput}
                  type="text"
                  value={row.translation}
                  placeholder="translation"
                  onChange={(e) => updateRow(row.key, "translation", e.target.value)}
                />
                <button
                  type="button"
                  className={styles.deleteRowBtn}
                  onClick={() => deleteRow(row.key)}
                  aria-label={`Delete pair ${row.word || "(empty)"}`}
                  title="Delete this pair"
                  disabled={rows.length === 1}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button type="button" className={styles.addRowBtn} onClick={addRow}>
            + Add pair
          </button>

          <div className={styles.resultActions}>
            <button className={styles.btnSecondary} onClick={handleReset}>Clear all</button>
            <button className={styles.btnSuccess} onClick={handleConfirm} disabled={validRows.length === 0}>
              Create flashcards →
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className={styles.errorBox}><strong>Error:</strong> {error}</div>}

      {/* Result review — shared by both modes */}
      {result && (
        <div className={styles.resultSection}>
          <div className={styles.resultColumns}>
            <div className={styles.resultImageCol}>
              <p className={styles.colLabel}>{mode === "image" ? "Your image" : "Your text"}</p>
              {mode === "image" && preview ? (
                <img src={preview} alt="Uploaded" className={styles.resultImg} />
              ) : (
                <div className={styles.textSourcePreview}>{textInput}</div>
              )}
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
                rows={Math.max(rows.length + 2, 6)}
              />

              <p className={styles.colLabel} style={{ marginTop: "1.25rem" }}>
                Flashcard pairs{" "}
                <span className={styles.pairsCount}>{validRows.length} ready</span>
              </p>

              <div className={styles.pairsEditList}>
                {rows.map((row) => (
                  <div key={row.key} className={styles.pairEditRow}>
                    <input
                      className={styles.pairInput}
                      type="text"
                      value={row.word}
                      placeholder="word"
                      onChange={(e) => updateRow(row.key, "word", e.target.value)}
                    />
                    <span className={styles.pairSep}>→</span>
                    <input
                      className={styles.pairInput}
                      type="text"
                      value={row.translation}
                      placeholder="translation"
                      onChange={(e) => updateRow(row.key, "translation", e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.deleteRowBtn}
                      onClick={() => deleteRow(row.key)}
                      aria-label={`Delete pair ${row.word || "(empty)"}`}
                      title="Delete this pair"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" className={styles.addRowBtn} onClick={addRow}>
                + Add pair
              </button>
            </div>
          </div>
          <div className={styles.resultActions}>
            <button className={styles.btnSecondary} onClick={handleReset}>Start over</button>
            <button className={styles.btnSuccess} onClick={handleConfirm} disabled={validRows.length === 0}>
              Looks correct — create flashcards →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}