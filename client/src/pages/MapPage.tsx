import { useState } from 'react';
import type { Milestone } from '@questline/shared';
import { RoadmapView } from '../components/RoadmapView/RoadmapView';
import { MilestoneSheet } from '../components/MilestoneSheet/MilestoneSheet';
import { PageShell } from '../components/PageShell/PageShell';
import { useRoadmap } from '../hooks/useRoadmap';

export type MapPageProps = {
  userEmail?: string | null;
  onLogout?: () => void;
};

export function MapPage({ userEmail = null, onLogout }: MapPageProps) {
  const { data, loading, error, reload } = useRoadmap();
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  return (
    <PageShell userEmail={userEmail} onLogout={onLogout}>
      <main className="flex w-full justify-center">
        <RoadmapView
          goal={data?.goal ?? null}
          milestones={data?.milestones ?? []}
          loading={loading}
          error={error}
          onSelectMilestone={(milestone) => {
            setSelectedMilestone(milestone);
          }}
        />
      </main>

      <MilestoneSheet
        milestone={selectedMilestone}
        timeBudgetMinutesPerDay={data?.goal?.time_budget_minutes_per_day ?? null}
        onClose={() => {
          setSelectedMilestone(null);
        }}
        onQuestsChanged={() => {
          void reload();
        }}
      />
    </PageShell>
  );
}
