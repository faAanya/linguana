"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../Auth/AuthContext";
import styles from "./ProfileButton.module.css";

interface Props {
  onLoginClick: () => void;
}

export default function ProfileButton({ onLoginClick }: Props) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) {
    return (
      <button className={styles.loginBtn} onClick={onLoginClick}>
        Log in
      </button>
    );
  }

  const initials = user.name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.avatar}
        onClick={() => setOpen((o) => !o)}
        aria-label="Open profile menu"
        aria-expanded={open}
      >
        {initials}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <p className={styles.dropdownName}>{user.name}</p>
            <p className={styles.dropdownEmail}>{user.email}</p>
          </div>

          <div className={styles.dropdownDivider} />

          <Link href="/words" className={styles.dropdownItem}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            My words
          </Link>

          <Link href="/decks" className={styles.dropdownItem}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 3V2.5A1.5 1.5 0 015.5 1h5A1.5 1.5 0 0112 2.5V3" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            My decks
          </Link>

          <Link href="/profile" className={styles.dropdownItem}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            My profile
          </Link>

          <div className={styles.dropdownDivider} />

          <button
            className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
            onClick={async () => { setOpen(false); await logout(); }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}