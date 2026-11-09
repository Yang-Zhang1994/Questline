import type { StampCard as StampCardData } from '@questline/shared';

export type StampCardProps = {
  stampCard: StampCardData;
};

/**
 * Fixed-slot stamp card for active days (Issue #13).
 * Shows filled ♡ stamps and empty slots; past cards summarized below.
 */
export function StampCard({ stampCard }: StampCardProps) {
  const { card_number, stamps_per_card, stamped_dates, filled_count, past_cards } = stampCard;
  const slots = Array.from({ length: stamps_per_card }, (_, index) => {
    const date = stamped_dates[index] ?? null;
    return { index, date, filled: date != null };
  });

  const label = `Stamp card ${card_number}: ${filled_count} of ${stamps_per_card} stamps`;

  return (
    <section
      className="w-full max-w-[640px] rounded-window border-[3px] border-pink/40 bg-white/80 px-3 py-3 shadow-sm"
      data-testid="stamp-card"
      aria-label={label}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="m-0 font-display text-[0.95rem] text-pink-ink">
          ✦ Stamp card {card_number}
        </h2>
        <p className="m-0 font-ui text-[0.75rem] text-ink-soft">
          {filled_count}/{stamps_per_card} days
        </p>
      </div>

      <ul
        className="m-0 grid list-none grid-cols-7 gap-1.5 p-0"
        data-testid="stamp-card-slots"
      >
        {slots.map((slot) => (
          <li key={slot.index} className="min-w-0">
            <div
              className={
                slot.filled
                  ? 'flex aspect-square items-center justify-center rounded-[12px] border border-pink/50 bg-gel-pink text-[0.85rem] text-white shadow-sm'
                  : 'flex aspect-square items-center justify-center rounded-[12px] border border-dashed border-ink-soft/35 bg-pink-pale/60 text-[0.7rem] text-ink-soft/50'
              }
              data-testid={slot.filled ? 'stamp-slot-filled' : 'stamp-slot-empty'}
              title={slot.date ?? 'Empty stamp slot'}
              aria-label={
                slot.filled ? `Stamped on ${slot.date}` : `Empty stamp slot ${slot.index + 1}`
              }
            >
              {slot.filled ? '♡' : '·'}
            </div>
          </li>
        ))}
      </ul>

      {past_cards.length > 0 ? (
        <p
          className="m-0 mt-2 font-ui text-[0.72rem] text-ink-soft"
          data-testid="stamp-card-history"
        >
          Past cards saved: {past_cards.map((c) => `#${c.card_number}`).join(', ')} (
          {past_cards.reduce((sum, c) => sum + c.stamp_count, 0)} stamps)
        </p>
      ) : (
        <p className="m-0 mt-2 font-ui text-[0.72rem] text-ink-soft">
          One stamp each day you finish a quest
        </p>
      )}
    </section>
  );
}
