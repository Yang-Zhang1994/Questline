import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiaryNote } from './DiaryNote';

afterEach(() => {
  cleanup();
});

describe('DiaryNote (Issue #19)', () => {
  // AC: Today view shows a "Diary note for today" text area
  // AC: The text area has a visible label and works with the keyboard
  it('renders a labeled textarea for today\'s diary note', () => {
    const onChange = vi.fn();
    render(<DiaryNote content="" onChange={onChange} />);

    expect(screen.getByTestId('diary-note')).toBeInTheDocument();
    const field = screen.getByRole('textbox', { name: /Diary note for today/i });
    expect(field.tagName).toBe('TEXTAREA');
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  // AC: The note saves automatically (e.g., when the user stops typing)
  it('forwards typing and blur for autosave (no Save button)', () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(<DiaryNote content="hi" onChange={onChange} onBlur={onBlur} />);

    const field = screen.getByRole('textbox', { name: /Diary note for today/i });
    fireEvent.change(field, { target: { value: 'hi there' } });
    expect(onChange).toHaveBeenCalledWith('hi there');

    fireEvent.blur(field);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('surfaces save errors accessibly', () => {
    render(
      <DiaryNote
        content=""
        onChange={() => undefined}
        error="Could not save your diary note"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/Could not save/i);
  });
});
