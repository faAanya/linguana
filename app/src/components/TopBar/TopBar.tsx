"use client";

import { useState } from "react";
import ProfileButton from "@/app/src/components/ProfileButton/ProfileButton";
import AuthModal from "@/app/src/components/Auth/AuthModal";
import styles from "./TopBar.module.css";
import Link from "next/link";

export default function TopBar() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <>
      <header className={styles.bar}>
        <span className={styles.logo}>
          <Link href="/" className={styles.logo}>LinguaFlash</Link>
        </span>
        <ProfileButton onLoginClick={() => setShowAuth(true)} />
      </header>

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} />
      )}
    </>
  );
}
