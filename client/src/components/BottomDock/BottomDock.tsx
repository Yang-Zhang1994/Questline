import { useNavigate } from 'react-router';
import styles from './BottomDock.module.css';

export interface BottomDockProps {
  activeTab: 'today' | 'map' | 'talk';
}

export function BottomDock({ activeTab }: BottomDockProps) {
  const navigate = useNavigate();

  return (
    <nav className={styles.dock} aria-label="Main navigation">
      <button
        type="button"
        className={`${styles.dockItem} ${
          activeTab === 'today' ? styles.dockItemActive : ''
        }`}
        aria-current={activeTab === 'today' ? 'page' : undefined}
        onClick={() => {
          if (activeTab !== 'today') {
            navigate('/');
          }
        }}
      >
        ☀️ Today
      </button>

      <button
        type="button"
        className={`${styles.dockItem} ${
          activeTab === 'map' ? styles.dockItemActive : ''
        }`}
        aria-current={activeTab === 'map' ? 'page' : undefined}
        onClick={() => {
          if (activeTab !== 'map') {
            navigate('/map');
          }
        }}
      >
        🗺️ Map
      </button>

      <button
        type="button"
        className={`${styles.dockItem} ${
          activeTab === 'talk' ? styles.dockItemActive : ''
        }`}
        aria-current={activeTab === 'talk' ? 'page' : undefined}
        disabled
        title="Coming soon in Issue #2"
      >
        💌 Talk
      </button>
    </nav>
  );
}
