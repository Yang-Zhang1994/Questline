import { DailyNote } from '../components/DailyNote/DailyNote';
import { useDailyQuests } from '../hooks/useDailyQuests';
import styles from './TodayPage.module.css';

export function TodayPage() {
  const { data, loading, error, busyQuestId, toggleQuest } = useDailyQuests();

  return (
    <div className={styles.page}>
      <div className={styles.sparkles} aria-hidden="true" />
      <header className={styles.brand}>
        <h1 className={styles.brandTitle}>Questline</h1>
        <p className={styles.tagline}>your little quest diary with Mochi ♡</p>
      </header>

      <DailyNote
        data={data}
        loading={loading}
        error={error}
        busyQuestId={busyQuestId}
        onToggleQuest={(questId, completed) => {
          void toggleQuest(questId, completed);
        }}
      />

      <nav className={styles.dock} aria-label="Main">
        <button type="button" className={`${styles.dockItem} ${styles.dockItemActive}`}>
          ☀️ Today
        </button>
        <button type="button" className={styles.dockItem} disabled>
          🗺️ Map
        </button>
        <button type="button" className={styles.dockItem} disabled>
          💌 Talk
        </button>
      </nav>
    </div>
  );
}
