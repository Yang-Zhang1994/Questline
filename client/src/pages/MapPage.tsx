import { RoadmapView } from '../components/RoadmapView/RoadmapView';
import { BottomDock } from '../components/BottomDock/BottomDock';
import { useRoadmap } from '../hooks/useRoadmap';
import styles from './MapPage.module.css';

export function MapPage() {
  const { data, loading, error } = useRoadmap();

  return (
    <div className={styles.page}>
      <div className={styles.sparkles} aria-hidden="true" />
      <header className={styles.brand}>
        <h1 className={styles.brandTitle}>Questline</h1>
        <p className={styles.tagline}>your little quest diary with Mochi ♡</p>
      </header>

      <main className={styles.main}>
        <RoadmapView
          goal={data?.goal ?? null}
          milestones={data?.milestones ?? []}
          loading={loading}
          error={error}
        />
      </main>

      <BottomDock activeTab="map" />
    </div>
  );
}
