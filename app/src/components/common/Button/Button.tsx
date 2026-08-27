import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "danger" | "dangerGhost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

// Shared action button. `primary` (green), `secondary` (outline),
// `danger` (red), `dangerGhost` (outline with red text).
export default function Button({ variant = "primary", className, ...rest }: Props) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]} ${className ?? ""}`}
      {...rest}
    />
  );
}
