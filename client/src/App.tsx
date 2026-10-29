import { APP_NAME } from '@questline/shared';
import { DailyNote } from './DailyNote';

export function App() {
  return (
    <div className="app-shell">
      <div className="backdrop" aria-hidden="true" />
      <header className="topbar">
        <span className="brand">{APP_NAME}</span>
      </header>
      <main>
        <DailyNote />
      </main>
    </div>
  );
}
