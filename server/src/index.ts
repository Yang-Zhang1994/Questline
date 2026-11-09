import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { systemClock } from './clock.js';
import { createApp } from './app.js';
import { openDatabase } from './db/connection.js';
import { seedDemoDataIfEmpty } from './db/seed.js';

// Prefer repo-root `.env`, then `server/.env` (npm workspace cwd is `server/`).
const serverDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(serverDir, '../../.env') });
dotenv.config();

const port = Number(process.env.PORT ?? 3001);
const db = await openDatabase();
await seedDemoDataIfEmpty(db, systemClock);

const app = createApp({ db, clock: systemClock });

app.listen(port, () => {
  console.log(`Questline API listening on http://localhost:${port}`);
});
