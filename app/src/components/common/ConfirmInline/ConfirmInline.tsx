import styles from "./ConfirmInline.module.css";

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  disabled?: boolean;
}

// Inline "Delete / Cancel" confirmation used in list rows.
export default function ConfirmInline({
  onConfirm,
  onCancel,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  disabled = false,
}: Props) {
  return (
    <div className={styles.wrap}>
      <button className={styles.confirm} onClick={onConfirm} disabled={disabled}>
        {confirmLabel}
      </button>
      <button className={styles.cancel} onClick={onCancel} disabled={disabled}>
        {cancelLabel}
      </button>
    </div>
  );
}
