"use client";

import Link from "next/link";
import { useAuth } from "@/app/src/components/Auth/AuthContext";
import styles from "./page.module.css";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <span className={styles.badge}>Welcome</span>
        <h1 className={styles.title}>
          {user ? `Welcome back, ${user.name.split(" ")[0]}!` : "Welcome to LinguaFlash"}
        </h1>
        <p className={styles.subtitle}>
          Build your own vocabulary, turn it into flashcards, and practice the
          words that matter to you. Start by adding a word or importing a whole
          list.
        </p>

        <div className={styles.actions}>
          <Link href="/add-words" className={styles.btnPrimary}>＋ Add words</Link>
          <Link href="/import" className={styles.btnSecondary}>Create decks</Link>
        </div>
      </div>
    </main>
  );
}
