import type { Quest, TodayQuestsResponse } from '@questline/shared';
import { MochiAvatar } from '../MochiAvatar';
import { QuestItem } from '../QuestItem/QuestItem';
import styles from './DailyNote.module.css';

export type DailyNoteProps = {
  data: TodayQuestsResponse | null;
  loading?: boolean;
  error?: string | null;
  busyQuestId?: number | null;
  onToggleQuest: (questId: number, completed: boolean) => void;
};

export function DailyNote({
  data,
  loading = false,
  error = null,
  busyQuestId = null,
  onToggleQuest,
}: DailyNoteProps) {
  return (
    <section className={styles.window} aria-label="A note from Mochi">
      <header className={styles.titleBar}>
        <span className={styles.titleBarText}>✉ A note from Mochi</span>
        <span className={styles.hearts} aria-hidden="true">
          ♡ ♡
        </span>
      </header>

      <div className={styles.body}>
        <div className={styles.polaroid}>
          <MochiAvatar
            mood={
              data && data.done_count === data.total_count && data.total_count > 0
                ? 'wink'
                : 'happy'
            }
          />
        </div>

        <div className={styles.content}>
          {loading && !data ? (
            <p className={styles.greeting}>Mochi is writing today's note…</p>
          ) : null}

          {data ? (
            <>
              <p className={styles.greeting}>{data.greeting}</p>
              {data.milestone_title ? (
                <p className={styles.stage}>
                  Current milestone: <strong>{data.milestone_title}</strong>
                </p>
              ) : null}
              {data.total_count > 0 ? (
                <p className={styles.progress}>
                  Today's quests · {data.done_count}/{data.total_count} done
                </p>
              ) : null}

              {data.quests.length === 0 ? (
                <p className={styles.empty}>No quests for today — enjoy a soft rest day.</p>
              ) : (
                <ul className={styles.list}>
                  {data.quests.map((quest: Quest) => (
                    <QuestItem
                      key={quest.id}
                      quest={quest}
                      disabled={busyQuestId === quest.id}
                      onToggle={onToggleQuest}
                    />
                  ))}
                </ul>
              )}
            </>
          ) : null}

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
