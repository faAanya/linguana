"use client";

import { useState } from "react";
import Link from "next/link";
import ProfileButton from "@/app/src/components/ProfileButton/ProfileButton";
import AuthModal from "@/app/src/components/Auth/AuthModal";
import NavSections from "@/app/src/components/Nav/NavSections";
import styles from "./TopBar.module.css";

interface Props {
  showNav?: boolean;
}

export default function TopBar({ showNav = true }: Props) {
  const [showAuth, setShowAuth] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className={styles.bar}>
        <div className={styles.left}>
          {showNav && (
            <button
              className={styles.burger}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
            >
              <span className={styles.burgerBar} />
              <span className={styles.burgerBar} />
              <span className={styles.burgerBar} />
            </button>
          )}

          <Link href="/" className={styles.logo}>Linguana</Link>
        </div>

        <ProfileButton onLoginClick={() => setShowAuth(true)} />
      </header>

      {/* Mobile drawer — shows the sidebar sections */}
      {showNav && menuOpen && (
        <>
          <div className={styles.backdrop} onClick={() => setMenuOpen(false)} />
          <div className={styles.drawer}>
            <NavSections onNavigate={() => setMenuOpen(false)} />
          </div>
        </>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
