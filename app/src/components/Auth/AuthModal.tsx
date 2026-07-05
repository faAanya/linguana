"use client";

import { useState } from "react";
import { useAuth } from "./AuthContext";
import styles from "./AuthModal.module.css";

interface Props {
  onClose: () => void;
  initialMode?: "login" | "register";
  onSuccess?: () => void;
}

export default function AuthModal({ onClose, initialMode = "login", onSuccess }: Props) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      onSuccess ? onSuccess() : onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError(null);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>

        <h2 className={styles.title}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <p className={styles.subtitle}>
          {mode === "login"
            ? "Log in to save and access your decks"
            : "Sign up to start building your vocabulary"}
        </p>

        <div className={styles.fields}>
          {mode === "register" && (
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus={mode === "login"}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.btnSubmit}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <span className={styles.spinner}>
              <span className={styles.spinnerDot} />
              {mode === "login" ? "Logging in…" : "Creating account…"}
            </span>
          ) : mode === "login" ? (
            "Log in"
          ) : (
            "Create account"
          )}
        </button>

        <p className={styles.switchText}>
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button className={styles.switchBtn} onClick={switchMode}>
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
