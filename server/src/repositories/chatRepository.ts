import type { ChatMessage, ChatRole } from '@questline/shared';
import { toIsoDateTime } from '../clock.js';
import type { Db } from '../db/connection.js';

type ChatMessageRow = {
  id: number;
  user_id: number;
  goal_id: number | null;
  role: ChatRole;
  content: string;
  created_at: Date | string;
};

function mapCreatedAt(value: Date | string): string {
  if (value instanceof Date) return toIsoDateTime(value);
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return value;
  return toIsoDateTime(asDate);
}

function mapMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    user_id: row.user_id,
    goal_id: row.goal_id,
    role: row.role,
    content: row.content,
    created_at: mapCreatedAt(row.created_at),
  };
}

export function createChatRepository(db: Db) {
  return {
    async listForUser(userId: number): Promise<ChatMessage[]> {
      const result = await db.query<ChatMessageRow>(
        `SELECT id, user_id, goal_id, role, content, created_at
         FROM chat_messages
         WHERE user_id = $1
         ORDER BY id ASC`,
        [userId],
      );
      return result.rows.map(mapMessage);
    },

    async insert(
      userId: number,
      role: ChatRole,
      content: string,
      createdAt: string,
      goalId: number | null = null,
    ): Promise<ChatMessage> {
      const result = await db.query<ChatMessageRow>(
        `INSERT INTO chat_messages (user_id, goal_id, role, content, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, goal_id, role, content, created_at`,
        [userId, goalId, role, content, createdAt],
      );
      return mapMessage(result.rows[0]);
    },

    async insertPair(
      userId: number,
      userContent: string,
      mochiContent: string,
      userCreatedAt: string,
      mochiCreatedAt: string,
      goalId: number | null = null,
    ): Promise<{ userMessage: ChatMessage; mochiMessage: ChatMessage }> {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const userResult = await client.query<ChatMessageRow>(
          `INSERT INTO chat_messages (user_id, goal_id, role, content, created_at)
           VALUES ($1, $2, 'user', $3, $4)
           RETURNING id, user_id, goal_id, role, content, created_at`,
          [userId, goalId, userContent, userCreatedAt],
        );
        const mochiResult = await client.query<ChatMessageRow>(
          `INSERT INTO chat_messages (user_id, goal_id, role, content, created_at)
           VALUES ($1, $2, 'mochi', $3, $4)
           RETURNING id, user_id, goal_id, role, content, created_at`,
          [userId, goalId, mochiContent, mochiCreatedAt],
        );
        await client.query('COMMIT');
        return {
          userMessage: mapMessage(userResult.rows[0]),
          mochiMessage: mapMessage(mochiResult.rows[0]),
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

export type ChatRepository = ReturnType<typeof createChatRepository>;
