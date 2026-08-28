import { Card } from '../ui/Card';
import type { DailyAward } from '../../hooks/useLeaderboard';
import { Trophy, Gauge, Flame, Activity, Sliders, ShieldAlert, Wind, Zap } from 'lucide-react';
import type { ElementType } from 'react';

interface DailyAwardsProps {
  awards: DailyAward[];
  loading: boolean;
}

interface AwardMeta {
  name: string;
  Icon: ElementType;
  unit: string;
  color: string;
}

const AWARD_METADATA: Record<string, AwardMeta> = {
  speed_demon: { name: 'Speed Demon', Icon: Gauge, unit: 'MPH', color: 'text-cyan-400' },
  hottest_tire: { name: 'Hottest Tire', Icon: Flame, unit: '°F', color: 'text-red-400' },
  g_force_gladiator: { name: 'G-Force Gladiator', Icon: Activity, unit: 'G', color: 'text-purple-400' },
  suspension_slammer: { name: 'Suspension Slammer', Icon: Sliders, unit: '%', color: 'text-emerald-400' },
  brake_cooker: { name: 'Brake Cooker', Icon: ShieldAlert, unit: 'G', color: 'text-orange-400' },
  drift_king: { name: 'Drift King', Icon: Wind, unit: '°', color: 'text-blue-400' },
  rev_limiter_addict: { name: 'Rev-Limiter Addict', Icon: Zap, unit: 'Sec', color: 'text-yellow-400' },
};

export function DailyAwards({ awards, loading }: DailyAwardsProps) {
  if (loading) {
    return <div className="text-center text-gray-500 py-10 font-mono">Loading Daily Awards...</div>;
  }

  if (!awards || awards.length === 0) {
    return <div className="text-center text-gray-500 py-10 font-mono">No daily awards recorded yet today.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {awards.map((award) => {
        const rawKey = award.name.toLowerCase().replace(/ /g, '_');
        const meta = AWARD_METADATA[rawKey] || {
          name: award.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          Icon: Trophy,
          unit: '',
          color: 'text-emerald-400',
        };
        const IconComponent = meta.Icon;

        return (
          <Card key={award.id} className="p-4 flex flex-col justify-between gap-2.5 bg-[#0e0e16] border-white/10 hover:border-emerald-400/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <IconComponent size={16} className={meta.color} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white font-mono">{meta.name}</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    {award.gamertag || 'Current Record'}
                  </span>
                </div>
              </div>
              <Trophy size={14} className="text-amber-400/60" />
            </div>
            
            <div className="bg-black/50 rounded-xl p-3 flex justify-between items-baseline border border-white/5">
              <span className="text-2xl font-mono font-black text-white">
                {typeof award.value === 'number' ? award.value.toFixed(2) : award.value}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {meta.unit}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
