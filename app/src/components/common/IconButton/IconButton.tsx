import type { ButtonHTMLAttributes } from "react";
import styles from "./IconButton.module.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "danger" | "pin";
  active?: boolean; // e.g. a pinned/toggled state
}

// Small square icon button (edit / delete / pin actions).
export default function IconButton({
  variant = "default",
  active = false,
  className,
  ...rest
}: Props) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]} ${active ? styles.active : ""} ${className ?? ""}`}
      {...rest}
    />
  );
}
