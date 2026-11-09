import type { StampCard } from '@questline/shared';
import {
  STAMPS_PER_CARD,
  buildStampCardState,
  nextStampCardNumber,
  type StampRow,
} from '../config/game.js';
import type { Db } from '../db/connection.js';

type StampQueryClient = Pick<Db, 'query'>;

type StampDbRow = {
  card_number: number;
  stamp_date: string;
};

function mapRows(rows: StampDbRow[]): StampRow[] {
  return rows.map((r) => ({
    card_number: r.card_number,
    stamp_date: r.stamp_date,
  }));
}

export type StampMutationResult = {
  stamp_card: StampCard;
  /** True when this insert filled the last slot on a card. */
  card_completed: boolean;
  completed_card_number: number | null;
};

export function createStampRepository(db: Db) {
  return {
    async listForUser(userId: number, client: StampQueryClient = db): Promise<StampRow[]> {
      const result = await client.query<StampDbRow>(
        `SELECT card_number, stamp_date
         FROM stamps
         WHERE user_id = $1
         ORDER BY card_number ASC, stamp_date ASC`,
        [userId],
      );
      return mapRows(result.rows);
    },

    async getCardState(userId: number, client: StampQueryClient = db): Promise<StampCard> {
      const rows = await this.listForUser(userId, client);
      return buildStampCardState(rows, STAMPS_PER_CARD);
    },

    /**
     * Earn one stamp for an active local day (idempotent per date).
     * Caller must only invoke on the first quest completion of that day.
     */
    async addStampForDay(
      userId: number,
      localDate: string,
      client: StampQueryClient = db,
    ): Promise<StampMutationResult> {
      const existing = await client.query<{ id: number }>(
        `SELECT id FROM stamps WHERE user_id = $1 AND stamp_date = $2`,
        [userId, localDate],
      );
      if (existing.rows[0]) {
        const stamp_card = await this.getCardState(userId, client);
        return { stamp_card, card_completed: false, completed_card_number: null };
      }

      const rows = await this.listForUser(userId, client);
      const cardNumber = nextStampCardNumber(rows, STAMPS_PER_CARD);

      await client.query(
        `INSERT INTO stamps (user_id, card_number, stamp_date)
         VALUES ($1, $2, $3)`,
        [userId, cardNumber, localDate],
      );

      const after = await this.listForUser(userId, client);
      const onCard = after.filter((r) => r.card_number === cardNumber);
      const card_completed = onCard.length >= STAMPS_PER_CARD;
      // After a full card, snapshot advances to the next empty card.
      const stamp_card = buildStampCardState(after, STAMPS_PER_CARD);

      return {
        stamp_card,
        card_completed,
        completed_card_number: card_completed ? cardNumber : null,
      };
    },

    /**
     * Remove the stamp for a local day (when undoing the only completion that day).
     */
    async removeStampForDay(
      userId: number,
      localDate: string,
      client: StampQueryClient = db,
    ): Promise<StampCard> {
      await client.query(`DELETE FROM stamps WHERE user_id = $1 AND stamp_date = $2`, [
        userId,
        localDate,
      ]);
      return this.getCardState(userId, client);
    },
  };
}

export type StampRepository = ReturnType<typeof createStampRepository>;
