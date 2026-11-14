import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiaryNote } from '@questline/shared';
import { useDiaryNote } from '../../hooks/useDiaryNote';
import { DiaryNoteCard } from './DiaryNoteCard';

function DiaryHarness({
  goalId = 1,
  localDate = '2026-11-10',
  debounceMs = 1000,
}: {
  goalId?: number | null;
  localDate?: string | null;
  debounceMs?: number;
}) {
  const diary = useDiaryNote({ goalId, localDate, debounceMs });
  if (!goalId) return null;
  return (
    <DiaryNoteCard
      content={diary.content}
      loading={diary.loading}
      saveStatus={diary.saveStatus}
      saveError={diary.saveError}
      onChange={diary.updateContent}
      onBlur={diary.flushSave}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('DiaryNoteCard & useDiaryNote (Issue #19)', () => {
  it('connects a visible label to the textarea, works with keyboard typing, and has no Save button', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: null,
          goal_id: 1,
          note_date: '2026-11-10',
          content: '',
          updated_at: null,
        } satisfies DiaryNote),
    } as Response);

    render(<DiaryHarness debounceMs={5000} />);

    const textarea = await screen.findByLabelText(/diary note for today/i);
    expect(textarea).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();

    // Tab to focus via keyboard and type
    await user.tab();
    expect(textarea).toHaveFocus();
    await user.keyboard('Felt cozy reading today');
    expect(textarea).toHaveValue('Felt cozy reading today');
  });

  it('loads the saved note for the same day when reopening the app', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: 7,
          goal_id: 1,
          note_date: '2026-11-10',
          content: 'Read 2 pages over matcha latte ♡',
          updated_at: '2026-11-10T15:00:00Z',
        } satisfies DiaryNote),
    } as Response);

    render(<DiaryHarness localDate="2026-11-10" />);

    const textarea = await screen.findByLabelText(/diary note for today/i);
    await waitFor(() => {
      expect(textarea).toHaveValue('Read 2 pages over matcha latte ♡');
    });
    expect(fetchSpy).toHaveBeenCalledWith('/api/diary-notes?local_date=2026-11-10', expect.anything());
  });

  it('autosaves ~1 second after typing stops and shows "Saving…" then "Saved ♡"', async () => {
    vi.useFakeTimers();

    let resolveSave!: (res: Response) => void;
    const savePromise = new Promise<Response>((resolve) => {
      resolveSave = resolve;
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: null,
            goal_id: 1,
            note_date: '2026-11-10',
            content: '',
            updated_at: null,
          } satisfies DiaryNote),
      } as Response)
      .mockReturnValueOnce(savePromise);

    render(<DiaryHarness localDate="2026-11-10" debounceMs={1000} />);

    // Flush initial load
    await act(async () => {
      await Promise.resolve();
    });

    const textarea = screen.getByLabelText(/diary note for today/i);
    fireEvent.change(textarea, { target: { value: 'First step',} });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.change(textarea, { target: { value: 'First step complete!' } });

    // Before 1000ms after the last keystroke, PUT has not been called yet
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // At 1000ms after stopping typing, autosave triggers and shows "Saving…"
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0]).toBe('/api/diary-notes');
    expect(fetchSpy.mock.calls[1][1]?.method).toBe('PUT');
    expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toEqual({
      content: 'First step complete!',
      local_date: '2026-11-10',
    });
    expect(screen.getByTestId('diary-save-status')).toHaveTextContent('Saving…');

    // Resolve PUT -> status updates to "Saved ♡"
    await act(async () => {
      resolveSave({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: 1,
            goal_id: 1,
            note_date: '2026-11-10',
            content: 'First step complete!',
            updated_at: '2026-11-10T15:01:00Z',
          } satisfies DiaryNote),
      } as Response);
    });

    expect(screen.getByTestId('diary-save-status')).toHaveTextContent('Saved ♡');
  });

  it('saves immediately when the textarea loses focus (onBlur)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: null,
            goal_id: 1,
            note_date: '2026-11-10',
            content: '',
            updated_at: null,
          } satisfies DiaryNote),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: 1,
            goal_id: 1,
            note_date: '2026-11-10',
            content: 'Saved on blur ♡',
            updated_at: '2026-11-10T15:02:00Z',
          } satisfies DiaryNote),
      } as Response);

    render(<DiaryHarness localDate="2026-11-10" debounceMs={10_000} />);

    const textarea = await screen.findByLabelText(/diary note for today/i);
    fireEvent.change(textarea, { target: { value: 'Saved on blur ♡' } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(screen.getByTestId('diary-save-status')).toHaveTextContent('Saved ♡');
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toEqual({
      content: 'Saved on blur ♡',
      local_date: '2026-11-10',
    });
  });

  it('shows a friendly message and never loses what the user typed when saving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: null,
            goal_id: 1,
            note_date: '2026-11-10',
            content: '',
            updated_at: null,
          } satisfies DiaryNote),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () =>
          JSON.stringify({
            error: { code: 'INTERNAL_ERROR', message: '' },
          }),
      } as Response);

    render(<DiaryHarness localDate="2026-11-10" debounceMs={5000} />);

    const textarea = await screen.findByLabelText(/diary note for today/i);
    fireEvent.change(textarea, { target: { value: 'Precious reflection that must not be lost' } });
    fireEvent.blur(textarea);

    const alert = await screen.findByTestId('diary-save-error');
    expect(alert).toHaveTextContent(/couldn't save your diary note just now/i);
    expect(textarea).toHaveValue('Precious reflection that must not be lost');
  });

  it('prevents an older, slower save from overwriting a newer one', async () => {
    let resolveSlowSave!: (res: Response) => void;
    const slowSavePromise = new Promise<Response>((resolve) => {
      resolveSlowSave = resolve;
    });

    let resolveFastSave!: (res: Response) => void;
    const fastSavePromise = new Promise<Response>((resolve) => {
      resolveFastSave = resolve;
    });

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: null,
            goal_id: 1,
            note_date: '2026-11-10',
            content: '',
            updated_at: null,
          } satisfies DiaryNote),
      } as Response)
      .mockReturnValueOnce(slowSavePromise)
      .mockReturnValueOnce(fastSavePromise);

    render(<DiaryHarness localDate="2026-11-10" debounceMs={5000} />);

    const textarea = await screen.findByLabelText(/diary note for today/i);

    // 1. Trigger older save #1 via blur
    fireEvent.change(textarea, { target: { value: 'Older draft' } });
    fireEvent.blur(textarea);
    expect(screen.getByTestId('diary-save-status')).toHaveTextContent('Saving…');

    // 2. While save #1 is still in flight, user types newer text and blurs (triggers save #2)
    fireEvent.change(textarea, { target: { value: 'Newer final reflection' } });
    fireEvent.blur(textarea);

    // 3. Newer save #2 finishes first
    await act(async () => {
      resolveFastSave({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: 1,
            goal_id: 1,
            note_date: '2026-11-10',
            content: 'Newer final reflection',
            updated_at: '2026-11-10T15:05:00Z',
          } satisfies DiaryNote),
      } as Response);
    });

    expect(screen.getByTestId('diary-save-status')).toHaveTextContent('Saved ♡');
    expect(textarea).toHaveValue('Newer final reflection');

    // 4. Older save #1 finishes late (or even fails) -> must not overwrite textarea or status
    await act(async () => {
      resolveSlowSave({
        ok: false,
        status: 500,
        text: async () =>
          JSON.stringify({
            error: { code: 'INTERNAL_ERROR', message: 'Stale error' },
          }),
      } as Response);
    });

    expect(textarea).toHaveValue('Newer final reflection');
    expect(screen.getByTestId('diary-save-status')).toHaveTextContent('Saved ♡');
    expect(screen.queryByTestId('diary-save-error')).not.toBeInTheDocument();
  });
});
