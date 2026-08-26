"use client";

import { useState } from "react";
import styles from "./ThemeToggle.module.css";

type Theme = "light" | "dark";

// The actual theme was already applied to <html data-theme> by the inline
// script in the layout, so we read it from there (client-only).
function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={styles.switch}
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      suppressHydrationWarning
    >
      <span className={styles.track} data-state={theme} suppressHydrationWarning>
        <svg className={styles.sun} width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.2 4.2l2 2M17.8 17.8l2 2M19.8 4.2l-2 2M6.2 17.8l-2 2"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <svg className={styles.moon} width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M20 14.5A8 8 0 019.5 4a7 7 0 108.5 10.5 8.2 8.2 0 002 0z" fill="currentColor" />
        </svg>
        <span className={styles.knob} suppressHydrationWarning />
      </span>
    </button>
  );
}
