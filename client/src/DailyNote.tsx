import { useCallback, useEffect, useState } from 'react';
import type { Quest } from '@questline/shared';
import { completeQuest, fetchTodayQuests, uncompleteQuest } from './api';
import { QuestItem } from './QuestItem';

function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function DailyNote() {
  const [date, setDate] = useState<string | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchTodayQuests();
        if (cancelled) return;
        setDate(data.date);
        setQuests(data.quests);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load quests');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = useCallback(async (quest: Quest) => {
    setBusyId(quest.id);
    setError(null);
    try {
      const updated = quest.completed
        ? await uncompleteQuest(quest.id)
        : await completeQuest(quest.id);
      setQuests((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update quest');
    } finally {
      setBusyId(null);
    }
  }, []);

  if (loading) {
    return (
      <section className="daily-note" aria-busy="true">
        <p className="muted">Loading today's quests…</p>
      </section>
    );
  }

  const doneCount = quests.filter((q) => q.completed).length;

  return (
    <section className="daily-note">
      <header className="daily-header">
        <p className="eyebrow">Daily note</p>
        <h1>{date ? formatDisplayDate(date) : "Today's quests"}</h1>
        <p className="lede">
          Check off what you finish. Tap again if you marked something by mistake.
        </p>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="quest-list">
        {quests.map((quest) => (
          <QuestItem
            key={quest.id}
            quest={quest}
            busy={busyId === quest.id}
            onToggle={onToggle}
          />
        ))}
      </ul>

      <p className="progress muted">
        {doneCount} of {quests.length} complete
      </p>
    </section>
  );
}
