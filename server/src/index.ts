import { systemClock } from './clock.js';
import { createApp } from './app.js';
import { openDatabase } from './db/connection.js';
import { seedDemoDataIfEmpty } from './db/seed.js';

const port = Number(process.env.PORT ?? 3001);
const db = openDatabase();
seedDemoDataIfEmpty(db, systemClock);

const app = createApp({ db, clock: systemClock });

app.listen(port, () => {
  console.log(`Questline API listening on http://localhost:${port}`);
});
