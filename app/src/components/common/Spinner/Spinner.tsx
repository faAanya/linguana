import styles from "./Spinner.module.css";

interface Props {
  /** Push the spinner down the page (default true — for full-page loaders). */
  center?: boolean;
}

// The circular loading spinner used across pages and loading states.
export default function Spinner({ center = true }: Props) {
  return <div className={`${styles.spinner} ${center ? styles.center : ""}`} />;
}
