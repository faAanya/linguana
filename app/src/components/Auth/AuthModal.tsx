"use client";

import { useState } from "react";
import { useAuth } from "./AuthContext";
import styles from "./AuthModal.module.css";

interface Props {
  onClose: () => void;
  initialMode?: "login" | "register";
  onSuccess?: () => void;
}

type Stage = "details" | "code";

export default function AuthModal({ onClose, initialMode = "login", onSuccess }: Props) {
  const { requestRegisterCode, requestLoginCode, verifyCode } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [stage, setStage] = useState<Stage>("details");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Stage 1: send the code
  const handleSendCode = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        await requestRegisterCode(name, email);
      } else {
        await requestLoginCode(email);
      }
      setStage("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Stage 2: verify the code
  const handleVerify = async () => {
    setError(null);
    setLoading(true);
    try {
      await verifyCode(email, code);
      onSuccess ? onSuccess() : onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setStage("details");
    setError(null);
    setCode("");
  };

  const backToDetails = () => {
    setStage("details");
    setError(null);
    setCode("");
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>

        {stage === "details" ? (
          <>
            <h2 className={styles.title}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className={styles.subtitle}>
              {mode === "login"
                ? "Enter your email and we'll send you a login code"
                : "Enter your details and we'll send you a verification code"}
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
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                  autoFocus={mode === "login"}
                />
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button className={styles.btnSubmit} onClick={handleSendCode} disabled={loading}>
              {loading ? (
                <span className={styles.spinner}>
                  <span className={styles.spinnerDot} />
                  Sending code…
                </span>
              ) : (
                "Send code"
              )}
            </button>

            <p className={styles.switchText}>
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button className={styles.switchBtn} onClick={switchMode}>
                {mode === "login" ? "Sign up" : "Log in"}
              </button>
            </p>
          </>
        ) : (
          <>
            <h2 className={styles.title}>Enter your code</h2>
            <p className={styles.subtitle}>
              We sent a 6-digit code to <strong>{email}</strong>
            </p>

            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>Verification code</label>
                <input
                  className={styles.codeInput}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  autoFocus
                />
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              className={styles.btnSubmit}
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
            >
              {loading ? (
                <span className={styles.spinner}>
                  <span className={styles.spinnerDot} />
                  Verifying…
                </span>
              ) : (
                "Verify & continue"
              )}
            </button>

            <p className={styles.switchText}>
              Didn't get it?{" "}
              <button className={styles.switchBtn} onClick={backToDetails}>
                Try again
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}