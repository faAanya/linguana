"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/src/components/Auth/AuthContext";
import AuthModal from "@/app/src/components/Auth/AuthModal";
import styles from "./page.module.css";

export default function HomePage() {
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <span className={styles.badge}>Welcome</span>
        <h1 className={styles.title}>
          {user ? `Welcome back, ${user.name.split(" ")[0]}!` : "Welcome to Linguana"}
        </h1>
        <p className={styles.subtitle}>
          Build your own vocabulary, turn it into flashcards, and practice the
          words that matter to you.
          {user
            ? " Start by adding a word or importing a whole list."
            : " Log in to start building your collection."}
        </p>

        {user ? (
          <div className={styles.actions}>
            <Link href="/add-words" className={styles.btnPrimary}>＋ Add words</Link>
            <Link href="/import" className={styles.btnSecondary}>Create decks</Link>
          </div>
        ) : (
          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={() => setShowAuth(true)}>
              Log in / Sign up
            </button>
          </div>
        )}
      </div>

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />
      )}
    </main>
  );
}
