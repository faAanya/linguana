import NavSections from "./NavSections";
import styles from "./Sidebar.module.css";

// Fixed left navigation, visible on wider screens. On small screens it is
// hidden and the same sections are reached through the TopBar burger menu.
export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <NavSections />
    </aside>
  );
}
