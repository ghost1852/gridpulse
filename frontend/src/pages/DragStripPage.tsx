import { useState } from 'react';
import { useTelemetry } from '../hooks/useTelemetry';
import { useDailyAwards } from '../hooks/useLeaderboard';
import { SprintTimer } from '../components/dragstrip/SprintTimer';
import { RecentRuns } from '../components/dragstrip/RecentRuns';
import { GarageRankings } from '../components/dragstrip/GarageRankings';
import { DailyAwards } from '../components/dragstrip/DailyAwards';

export function DragStripPage() {
  const { analytics } = useTelemetry();
  const { awards, loading } = useDailyAwards();
  const [resetKey, setResetKey] = useState(0);

  const sprintStatus = analytics?.sprint_status || 'READY';
  const sprintTimes = analytics?.sprint_times || {};

  const handleReset = () => {
    setResetKey(prev => prev + 1);
  };

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-36 md:pb-12">
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-widest uppercase mb-1 font-mono">
          Drag Strip &amp; Performance Lab
        </h1>
        <p className="text-gray-500 font-mono text-xs sm:text-sm">
          High-Precision Staging, 60Hz Telemetry Milestones &amp; Garage Rankings
        </p>
      </div>

      {/* Primary Staging Time Slip */}
      <div className="flex justify-center">
        <SprintTimer 
          status={sprintStatus} 
          times={sprintTimes} 
          onReset={handleReset}
        />
      </div>

      {/* Garage Rankings: Fastest Cars in User's Fleet */}
      <div className="pt-4">
        <GarageRankings />
      </div>

      {/* Recent Telemetry Runs History Log */}
      <div className="pt-2">
        <RecentRuns refreshTrigger={sprintTimes?.quarter_mile || sprintTimes?.['0_60'] || resetKey} />
      </div>

      {/* Peak Records & Daily Awards */}
      <div className="space-y-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold tracking-wider font-mono">
            DAILY AWARDS &amp; PEAK RECORDS
          </h2>
          <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold">
            Live 60Hz Telemetry
          </span>
        </div>
        
        <DailyAwards awards={awards} loading={loading} />
      </div>

      {/* Extra clearance spacer for mobile bottom navigation */}
      <div className="h-10 lg:hidden pointer-events-none" />
    </div>
  );
}
