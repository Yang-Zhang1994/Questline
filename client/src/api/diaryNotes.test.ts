import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDiaryNote, saveDiaryNote } from './diaryNotes';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('diaryNotes api (Issue #19)', () => {
  it('GETs with local_date query', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: 1,
          goal_id: 2,
          note_date: '2026-11-09',
          content: 'hi',
          updated_at: '2026-11-09T12:00:00Z',
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const note = await fetchDiaryNote('2026-11-09');
    expect(note.content).toBe('hi');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/diary-notes?local_date=2026-11-09',
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it('PUTs content and local_date', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: 1,
          goal_id: 2,
          note_date: '2026-11-09',
          content: 'saved',
          updated_at: '2026-11-09T12:00:00Z',
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const note = await saveDiaryNote('saved', '2026-11-09');
    expect(note.content).toBe('saved');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/diary-notes',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ content: 'saved', local_date: '2026-11-09' }),
      }),
    );
  });
});
