import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { StampCard as StampCardType } from '@questline/shared';
import { StampCard } from './StampCard';

afterEach(() => {
  cleanup();
});

const sampleCard: StampCardType = {
  card_number: 2,
  stamps_per_card: 10,
  stamped_dates: ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11'],
  filled_count: 4,
  past_cards: [
    {
      card_number: 1,
      stamp_dates: [
        '2026-10-28',
        '2026-10-29',
        '2026-10-30',
        '2026-10-31',
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
        '2026-11-04',
        '2026-11-05',
        '2026-11-06',
      ],
      stamp_count: 10,
    },
  ],
};

describe('StampCard (Issue #13)', () => {
  it('exposes an accessible "4 of 10 stamps" summary and renders stamped vs empty slots', () => {
    render(<StampCard stampCard={sampleCard} />);

    // Screen readers hear "4 of 10 stamps" on the card and slot list
    expect(
      screen.getByRole('region', { name: /stamp card 2: 4 of 10 stamps/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '4 of 10 stamps' })).toBeInTheDocument();
    expect(screen.getByTestId('stamp-card-progress')).toHaveTextContent('4 of 10 stamps ♡');

    const slots = screen.getAllByTestId('stamp-slot');
    expect(slots).toHaveLength(10);

    const stampedSlots = slots.filter((el) => el.getAttribute('data-stamped') === 'true');
    const emptySlots = slots.filter((el) => el.getAttribute('data-stamped') === 'false');
    expect(stampedSlots).toHaveLength(4);
    expect(emptySlots).toHaveLength(6);

    // Individual slot accessible labels
    expect(screen.getByLabelText('Slot 1: stamped on 2026-11-08')).toBeInTheDocument();
    expect(screen.getByLabelText('Slot 4: stamped on 2026-11-11')).toBeInTheDocument();
    expect(screen.getByLabelText('Slot 5: empty')).toBeInTheDocument();
    expect(screen.getByLabelText('Slot 10: empty')).toBeInTheDocument();
  });

  it('lets the user view saved past stamp cards and their stamp history', () => {
    render(<StampCard stampCard={sampleCard} />);

    const toggleBtn = screen.getByTestId('toggle-past-cards');
    expect(toggleBtn).toHaveTextContent('View past cards (1)');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('past-stamp-cards-list')).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('past-stamp-cards-list')).toBeInTheDocument();
    expect(screen.getByTestId('past-stamp-card-item')).toHaveTextContent('★ Card #1');
    expect(screen.getByTestId('past-stamp-card-item')).toHaveTextContent('10 of 10 stamps');
    expect(screen.getByTestId('past-stamp-card-item')).toHaveTextContent('2026-10-28');
  });
});
