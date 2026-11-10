import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDiaryNote } from './useDiaryNote';

const fetchDiaryNote = vi.fn();
const saveDiaryNote = vi.fn();

vi.mock('../api/diaryNotes', () => ({
  fetchDiaryNote: (...args: unknown[]) => fetchDiaryNote(...args),
  saveDiaryNote: (...args: unknown[]) => saveDiaryNote(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  fetchDiaryNote.mockResolvedValue({
    id: 1,
    goal_id: 2,
    note_date: '2026-11-09',
    content: 'loaded note',
    updated_at: '2026-11-09T12:00:00Z',
  });
  saveDiaryNote.mockImplementation(async (content: string) => ({
    id: 1,
    goal_id: 2,
    note_date: '2026-11-09',
    content,
    updated_at: '2026-11-09T12:05:00Z',
  }));
});

describe('useDiaryNote (Issue #19)', () => {
  it('loads the saved note for the local date', async () => {
    const { result } = renderHook(() =>
      useDiaryNote({ activeGoalId: 2, localDate: '2026-11-09' }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchDiaryNote).toHaveBeenCalledWith('2026-11-09');
    expect(result.current.loading).toBe(false);
    expect(result.current.content).toBe('loaded note');
  });

  // AC: The note saves automatically when the user stops typing
  it('autosaves after the debounce window', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useDiaryNote({ activeGoalId: 2, localDate: '2026-11-09', debounceMs: 500 }),
    );

    // Flush the initial load promise under fake timers.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.loading).toBe(false);

    act(() => {
      result.current.setContent('typed reflection');
    });

    expect(saveDiaryNote).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(saveDiaryNote).toHaveBeenCalledWith('typed reflection', '2026-11-09');
    expect(result.current.saved).toBe(true);
  });
});
