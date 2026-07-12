"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProfileButton from "@/app/src/components/ProfileButton/ProfileButton";
import AuthModal from "@/app/src/components/Auth/AuthModal";
import styles from "./TopBar.module.css";

interface NavItem {
  href: string;
  label: string;
}

// Primary creation flows. Account pages (My words / My decks / profile)
// live in the ProfileButton dropdown instead.
const NAV: NavItem[] = [
  { href: "/", label: "Add words" },
  { href: "/import", label: "Create deck" },
];

export default function TopBar() {
  const pathname = usePathname();
  const [showAuth, setShowAuth] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const items = NAV;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className={styles.bar}>
        <div className={styles.left}>
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

          <Link href="/" className={styles.logo}>LinguaFlash</Link>

          <nav className={styles.tabs} aria-label="Primary">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.tab} ${isActive(item.href) ? styles.tabActive : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <ProfileButton onLoginClick={() => setShowAuth(true)} />
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div className={styles.backdrop} onClick={() => setMenuOpen(false)} />
          <nav className={styles.drawer} aria-label="Primary mobile">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.drawerItem} ${isActive(item.href) ? styles.drawerItemActive : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
