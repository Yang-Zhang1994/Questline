import { useState } from 'react';
import type { StampCard as StampCardType } from '@questline/shared';

export type StampCardProps = {
  stampCard: StampCardType;
};

/**
 * Cozy stamp card on Today view (Issue #13).
 * Shows fixed `stamps_per_card` slots (stamped vs empty), accessible summary
 * ("4 of 10 stamps"), and saved past cards history.
 */
export function StampCard({ stampCard }: StampCardProps) {
  const { card_number, stamps_per_card, stamped_dates, filled_count, past_cards } = stampCard;
  const [showPastCards, setShowPastCards] = useState(false);

  const summaryLabel = `${filled_count} of ${stamps_per_card} stamps`;
  const slots = Array.from({ length: stamps_per_card }, (_, idx) => {
    const stampedDate = stamped_dates[idx] ?? null;
    return {
      slotNumber: idx + 1,
      stamped: stampedDate !== null,
      stampedDate,
    };
  });

  return (
    <section
      className="relative z-[1] w-full max-w-[640px] overflow-hidden rounded-window border-[3px] border-pink bg-pink-pale shadow-window animate-rise-in motion-reduce:animate-none"
      aria-label={`Stamp card ${card_number}: ${summaryLabel}`}
      data-testid="stamp-card"
    >
      <header className="flex items-center justify-between gap-3 bg-gel-pink px-4 py-[0.65rem] font-display text-[1rem] tracking-[0.01em] text-white">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true">✦</span> Mochi’s Stamp Card #{card_number}
        </span>
        <span
          className="rounded-pill bg-white/25 px-3 py-0.5 font-body text-[0.82rem] font-bold text-white"
          data-testid="stamp-card-progress"
        >
          {summaryLabel} ♡
        </span>
      </header>

      <div className="bg-note-lines px-5 py-4">
        <p className="m-0 mb-3 text-[0.88rem] text-ink-soft">
          Each day you complete at least one quest earns a cozy stamp from Mochi.
        </p>

        <ol
          className="m-0 grid list-none grid-cols-5 gap-2.5 p-0 sm:gap-3"
          aria-label={summaryLabel}
          data-testid="stamp-card-slots"
        >
          {slots.map((slot) => (
            <li
              key={slot.slotNumber}
              data-testid="stamp-slot"
              data-stamped={slot.stamped ? 'true' : 'false'}
              aria-label={
                slot.stamped
                  ? `Slot ${slot.slotNumber}: stamped on ${slot.stampedDate}`
                  : `Slot ${slot.slotNumber}: empty`
              }
              title={slot.stamped ? `Stamped on ${slot.stampedDate}` : `Slot ${slot.slotNumber}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-[14px] border-2 px-1 py-1.5 text-center transition-colors ${
                slot.stamped
                  ? 'border-pink bg-walked/90 text-pink-ink shadow-sm'
                  : 'border-dashed border-pink/40 bg-panel/80 text-ink-soft/70'
              }`}
            >
              <span
                className="font-display text-[1.25rem] leading-none"
                aria-hidden="true"
              >
                {slot.stamped ? '✿' : '○'}
              </span>
              <span
                className="mt-1 font-ui text-[0.68rem] font-bold leading-tight"
                aria-hidden="true"
              >
                {slot.stamped ? slot.stampedDate?.slice(5) : `#${slot.slotNumber}`}
              </span>
            </li>
          ))}
        </ol>

        {past_cards.length > 0 ? (
          <div className="mt-4 border-t border-pink/25 pt-3" data-testid="past-stamp-cards-section">
            <div className="flex items-center justify-between gap-2">
              <span className="font-body text-[0.84rem] font-bold text-ink">
                Completed cards saved: {past_cards.length}
              </span>
              <button
                type="button"
                onClick={() => setShowPastCards((prev) => !prev)}
                aria-expanded={showPastCards}
                data-testid="toggle-past-cards"
                className="rounded-pill border border-pink/45 bg-panel px-3 py-1 font-body text-[0.78rem] font-bold text-pink-ink shadow-sm hover:bg-pink-pale"
              >
                {showPastCards ? 'Hide past cards' : `View past cards (${past_cards.length})`}
              </button>
            </div>

            {showPastCards ? (
              <ul
                className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0"
                data-testid="past-stamp-cards-list"
              >
                {past_cards.map((past) => (
                  <li
                    key={past.card_number}
                    data-testid="past-stamp-card-item"
                    className="rounded-[12px] border border-pink/35 bg-panel/95 px-3.5 py-2.5 text-left shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-[0.88rem] text-pink-ink">
                        ★ Card #{past.card_number}
                      </span>
                      <span className="font-ui text-[0.76rem] font-bold text-blue-ink">
                        {past.stamp_count} of {stamps_per_card} stamps
                      </span>
                    </div>
                    <p className="m-0 mt-1 font-ui text-[0.74rem] text-ink-soft">
                      Dates: {past.stamp_dates.join(', ')}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
