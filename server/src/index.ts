import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createQuestStore } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile =
  process.env.QUESTLINE_DATA_FILE ??
  path.join(__dirname, '..', 'data', 'quests.json');

const store = createQuestStore(dataFile);
const app = createApp(store);
const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`Questline server listening on http://localhost:${port}`);
});
