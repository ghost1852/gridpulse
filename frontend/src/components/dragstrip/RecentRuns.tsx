import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { getCarInfo } from '../../lib/cars';
import { useUnits } from '../../context/UnitContext';
import { apiFetch } from '../../lib/api';
import { History, Trash2 } from 'lucide-react';

interface SprintRun {
  id: number;
  car_ordinal: number;
  car_class: number | string;
  car_pi: number;
  category: string;
  time_seconds: number;
  speed_mph: number;
  created_at: string;
}

export function RecentRuns({ refreshTrigger }: { refreshTrigger?: any }) {
  const [runs, setRuns] = useState<SprintRun[]>([]);
  const [loading, setLoading] = useState(true);
  const { units } = useUnits();
  const isKph = units.speed === 'kph';

  const fetchRuns = async () => {
    try {
      const res = await apiFetch('/api/drag/recent?limit=30');
      const data = await res.json();
      if (data && data.recent_runs) {
        setRuns(data.recent_runs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 2000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  const handleClearHistory = async () => {
    if (confirm('Clear all local sprint history?')) {
      try {
        await apiFetch('/api/drag/clear', { method: 'POST' });
        setRuns([]);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const resolveClass = (c: number | string, pi: number) => {
    if (pi >= 999) return 'X';
    if (c === 6 || c === '6' || pi === 998) return 'R';
    const map: Record<string, string> = {
      '0': 'D', '1': 'C', '2': 'B', '3': 'A', '4': 'S1', '5': 'S2', '6': 'R', '7': 'P', '8': 'X'
    };
    return map[String(c)] || String(c);
  };

  const formatCategory = (cat: string) => {
    switch (cat) {
      case '0-60': return isKph ? '0 - 100 KM/H' : '0 - 60 MPH';
      case '0-100': return isKph ? '0 - 160 KM/H' : '0 - 100 MPH';
      case '60-130': return isKph ? '100 - 200 KM/H' : '60 - 130 MPH';
      case 'quarter_mile': return isKph ? '400M (1/4 MI)' : '1/4 MILE';
      case 'half_mile': return isKph ? '805M (1/2 MI)' : '1/2 MILE';
      case 'braking_100_0': return isKph ? '160 - 0 KM/H BRAKE' : '100 - 0 MPH BRAKE';
      default: return cat.toUpperCase();
    }
  };

  const formatSpeed = (mph: number) => {
    if (!mph || mph <= 0) return '';
    if (isKph) {
      return `${(mph * 1.60934).toFixed(1)} KM/H`;
    }
    return `${mph.toFixed(1)} MPH`;
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'Z');
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="p-3.5 sm:p-5 space-y-3 sm:space-y-4 bg-[#111118] border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <History size={16} className="text-emerald-400" />
          <h2 className="text-xs sm:text-base font-bold font-mono tracking-wider text-white uppercase">
            RECENT SPRINT RUNS &amp; TELEMETRY LOG
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 font-bold">
            {runs.length} Runs
          </span>
          {runs.length > 0 && (
            <button
              type="button"
              onPointerDown={handleClearHistory}
              onClick={handleClearHistory}
              className="text-gray-500 hover:text-red-400 text-xs p-1 rounded transition-colors touch-manipulation cursor-pointer"
              title="Clear History"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {loading && runs.length === 0 ? (
        <div className="py-6 text-center text-xs font-mono text-gray-500">
          Loading sprint telemetry runs...
        </div>
      ) : runs.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-gray-500 space-y-1">
          <div>No sprint runs recorded yet.</div>
          <div className="text-gray-600 text-[10px]">Stage at 0 MPH and hit the throttle to record your first run!</div>
        </div>
      ) : (
        /* Mobile Optimized Clean Cards List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {runs.map((run) => {
            const resolvedClass = resolveClass(run.car_class, run.car_pi);
            const car = getCarInfo(run.car_ordinal, resolvedClass, run.car_pi);
            const speedStr = formatSpeed(run.speed_mph);

            return (
              <div 
                key={run.id} 
                className="p-3 bg-black/60 border border-white/10 rounded-xl space-y-2 hover:border-emerald-500/40 transition-all font-mono shadow-sm"
              >
                {/* Top Row: Vehicle Badge + Name + PI + Timestamp */}
                <div className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Badge carClass={resolvedClass} className="text-[10px] px-1.5 py-0 shrink-0 font-black" />
                    <span className="font-bold text-white text-xs truncate">
                      {car.name}
                    </span>
                    <span className="text-[9px] text-gray-500 shrink-0">PI {run.car_pi}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 shrink-0">
                    {formatTimeAgo(run.created_at)}
                  </span>
                </div>

                {/* Bottom Row: Milestone Pill (Left) & Elapsed Time + Trap (Right) */}
                <div className="flex items-center justify-between pt-1.5 border-t border-white/5 gap-2">
                  <span className="text-[11px] font-bold text-gray-300 bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/10 shrink-0">
                    {formatCategory(run.category)}
                  </span>

                  <div className="flex items-baseline gap-2 text-right">
                    <span className="text-base sm:text-lg font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(0,255,136,0.3)]">
                      {Number(run.time_seconds).toFixed(3)}s
                    </span>
                    {speedStr && (
                      <span className="text-[11px] font-bold text-cyan-400 whitespace-nowrap">
                        {speedStr}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
