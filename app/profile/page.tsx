"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/src/components/Auth/AuthContext";
import LanguagePicker from "@/app/src/components/LanguagePicker/LanguagePicker";
import styles from "./page.module.css";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [native, setNative] = useState<string[]>([]);
  const [learning, setLearning] = useState<string[]>([]);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    fetch("/api/user/languages")
      .then((r) => r.json())
      .then((data) => {
        setNative(data.nativeLanguages ?? []);
        setLearning(data.learningLanguages ?? []);
      })
      .catch(() => setError("Failed to load your languages"))
      .finally(() => setFetching(false));
  }, [user, loading, router]);

  const canSave = native.length > 0 && learning.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/user/languages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learningLanguages: learning, nativeLanguages: native }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      setMessage("Saved!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading || fetching) {
    return (
      <main className={styles.main}>
        <div className={styles.spinner} />
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Profile</h1>
          <p className={styles.subtitle}>{user?.name} · {user?.email}</p>
        </div>

        <div className={styles.section}>
          <LanguagePicker
            label="I speak"
            hint="your native language(s)"
            selected={native}
            onChange={setNative}
            disabledCodes={learning}
          />
          <LanguagePicker
            label="I want to learn"
            hint="target language(s)"
            selected={learning}
            onChange={setLearning}
            disabledCodes={native}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.success}>{message}</p>}

        <button className={styles.btnSave} onClick={handleSave} disabled={!canSave || saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </main>
  );
}
