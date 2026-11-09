import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { StampCard as StampCardData } from '@questline/shared';
import { StampCard } from './StampCard';

afterEach(() => {
  cleanup();
});

const sample: StampCardData = {
  card_number: 1,
  stamps_per_card: 7,
  stamped_dates: ['2026-10-26', '2026-10-27', '2026-10-28'],
  filled_count: 3,
  past_cards: [],
};

describe('StampCard (Issue #13)', () => {
  // AC: The stamp card shows stamped and empty slots
  it('shows stamped and empty slots for the current card', () => {
    render(<StampCard stampCard={sample} />);

    expect(screen.getByTestId('stamp-card')).toBeInTheDocument();
    expect(screen.getByText(/Stamp card 1/i)).toBeInTheDocument();
    expect(screen.getByText(/3\/7 days/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('stamp-slot-filled')).toHaveLength(3);
    expect(screen.getAllByTestId('stamp-slot-empty')).toHaveLength(4);
    expect(
      screen.getByRole('region', { name: /Stamp card 1: 3 of 7 stamps/i }),
    ).toBeInTheDocument();
  });

  it('summarizes past stamp cards when history exists', () => {
    render(
      <StampCard
        stampCard={{
          card_number: 2,
          stamps_per_card: 7,
          stamped_dates: ['2026-11-01'],
          filled_count: 1,
          past_cards: [
            {
              card_number: 1,
              stamp_dates: [
                '2026-10-01',
                '2026-10-02',
                '2026-10-03',
                '2026-10-04',
                '2026-10-05',
                '2026-10-06',
                '2026-10-07',
              ],
              stamp_count: 7,
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId('stamp-card-history')).toHaveTextContent(/Past cards saved: #1/);
    expect(screen.getByTestId('stamp-card-history')).toHaveTextContent(/7 stamps/);
  });
});
