import { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Zap, Navigation, CheckCircle2 } from 'lucide-react';
import { useUnits } from '../../context/UnitContext';
import { apiFetch } from '../../lib/api';

interface SprintTimerProps {
  status: string;
  times: Record<string, number | null>;
  onReset?: () => void;
}

export function SprintTimer({ status, times, onReset }: SprintTimerProps) {
  const { units, setUnit } = useUnits();
  const isKph = units.speed === 'kph';

  // Persistent Memory of Previous Run
  const [persistedTimes, setPersistedTimes] = useState<Record<string, number | null>>(() => {
    try {
      const saved = localStorage.getItem('forza_last_time_slip');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const prevStatusRef = useRef(status);

  useEffect(() => {
    // Check if current times has valid completed milestones
    const hasValidTimes = Object.values(times || {}).some(v => v !== null && typeof v === 'number' && v > 0);
    if (hasValidTimes) {
      setPersistedTimes(times);
      try {
        localStorage.setItem('forza_last_time_slip', JSON.stringify(times));
      } catch {}
    }
  }, [times]);

  useEffect(() => {
    // When a new launch starts, clear the previous preserved slip
    if (prevStatusRef.current !== 'RUNNING' && status === 'RUNNING') {
      setPersistedTimes({});
    }
    prevStatusRef.current = status;
  }, [status]);

  const handleReset = () => {
    setPersistedTimes({});
    localStorage.removeItem('forza_last_time_slip');
    if (onReset) onReset();
    apiFetch('/api/drag/reset', { method: 'POST' }).catch(() => {});
  };

  const getStatusColor = () => {
    switch(status?.toUpperCase()) {
      case 'READY': return 'text-white';
      case 'STAGING': return 'text-yellow-400 animate-pulse';
      case 'RUNNING': return 'text-emerald-400 animate-pulse';
      case 'COMPLETED': return 'text-emerald-400 drop-shadow-[0_0_12px_#00ff88]';
      case 'REWIND': return 'text-orange-400';
      default: return 'text-gray-500';
    }
  };

  const formatTime = (sec: number | null | undefined) => {
    if (sec === null || sec === undefined || sec <= 0) return '--.---s';
    return Number(sec).toFixed(3) + 's';
  };

  // Merge live times with persisted previous run so results NEVER disappear while waiting at the line
  const activeTimes = status === 'RUNNING' ? times : { ...persistedTimes, ...times };
  const hasPreviousResults = Object.values(activeTimes || {}).some(v => v !== null && typeof v === 'number' && v > 0);

  const currentDistM = activeTimes?.distance_m || 0;
  const currentDistFt = activeTimes?.distance_ft || 0;

  const sprintGoals = isKph ? [
    { key: '0_100kph', label: '0 - 100 KM/H' },
    { key: '0_160kph', label: '0 - 160 KM/H' },
    { key: '100_200kph', label: '100 - 200 KM/H' },
    { 
      key: 'quarter_mile', 
      label: '400M (1/4 MILE)', 
      trapKey: 'trap_speed_quarter_kph',
      trapFallback: activeTimes?.trap_speed_quarter_mph ? Number((activeTimes.trap_speed_quarter_mph * 1.60934).toFixed(1)) : null,
      unit: 'KM/H'
    },
    { 
      key: 'half_mile', 
      label: '805M (1/2 MILE)', 
      trapKey: 'trap_speed_half_kph',
      trapFallback: activeTimes?.trap_speed_half_mph ? Number((activeTimes.trap_speed_half_mph * 1.60934).toFixed(1)) : null,
      unit: 'KM/H'
    },
  ] : [
    { key: '0_60', label: '0 - 60 MPH' },
    { key: '0_100', label: '0 - 100 MPH' },
    { key: '60_130', label: '60 - 130 MPH' },
    { 
      key: 'quarter_mile', 
      label: '1/4 MILE (402M)', 
      trapKey: 'trap_speed_quarter_mph',
      trapFallback: activeTimes?.trap_speed_quarter_kph ? Number((activeTimes.trap_speed_quarter_kph / 1.60934).toFixed(1)) : null,
      unit: 'MPH'
    },
    { 
      key: 'half_mile', 
      label: '1/2 MILE (805M)', 
      trapKey: 'trap_speed_half_mph',
      trapFallback: activeTimes?.trap_speed_half_kph ? Number((activeTimes.trap_speed_half_kph / 1.60934).toFixed(1)) : null,
      unit: 'MPH'
    },
  ];

  return (
    <Card className="max-w-md w-full mx-auto p-0 overflow-hidden font-mono bg-[#111118] border-white/10 shadow-2xl">
      {/* Receipt Header */}
      <div className="p-4 sm:p-5 border-b border-white/10 relative overflow-hidden bg-gradient-to-b from-white/5 to-transparent">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-75" />
        
        {/* Top Control Matrix: Units Toggle + Reset Button */}
        <div className="flex items-center justify-between gap-2 pb-2">
          {/* Unit Toggle Pill */}
          <div className="flex items-center bg-black/60 p-0.5 rounded-lg border border-white/10">
            <button
              type="button"
              onPointerDown={() => setUnit('speed', 'mph')}
              onClick={() => setUnit('speed', 'mph')}
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer touch-manipulation",
                !isKph ? "bg-emerald-500 text-black shadow font-black" : "text-gray-400 hover:text-white"
              )}
            >
              MPH • MILES
            </button>
            <button
              type="button"
              onPointerDown={() => setUnit('speed', 'kph')}
              onClick={() => setUnit('speed', 'kph')}
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer touch-manipulation",
                isKph ? "bg-cyan-500 text-black shadow font-black" : "text-gray-400 hover:text-white"
              )}
            >
              KM/H • KM
            </button>
          </div>

          {/* Reset Button */}
          <button
            type="button"
            onPointerDown={handleReset}
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/40 text-red-300 border border-red-500/30 text-[10px] font-bold transition-all cursor-pointer touch-manipulation"
          >
            <RotateCcw size={11} />
            <span>Reset Run</span>
          </button>
        </div>

        <div className="text-center pt-1">
          <span className="text-[9px] font-bold tracking-[0.25em] text-gray-400 uppercase">OFFICIAL TIME ATTACK</span>
          <h2 className="text-xl sm:text-2xl font-black tracking-[0.2em] text-white my-0.5">TIME SLIP</h2>
          
          <div className={cn("text-lg sm:text-xl font-black tracking-widest uppercase transition-colors", getStatusColor())}>
            {status || 'READY'}
          </div>

          {/* Status Subtitle showing previous run retention */}
          {(status === 'READY' || status === 'STAGING') && hasPreviousResults && (
            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] text-gray-400">
              <CheckCircle2 size={10} className="text-emerald-400" />
              <span>PREVIOUS RUN PRESERVED • HIT THROTTLE TO LAUNCH</span>
            </div>
          )}

          {/* Live Run Distance Gauge */}
          {status === 'RUNNING' && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 py-1 px-3 rounded-full border border-emerald-500/20 max-w-xs mx-auto animate-pulse">
              <Navigation size={12} className="rotate-45" />
              <span>
                {isKph 
                  ? `${currentDistM.toFixed(0)}m / 400m`
                  : `${currentDistFt.toFixed(0)} ft / 1,320 ft`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Times List */}
      <div className="p-4 sm:p-5 space-y-3">
        {sprintGoals.map((goal) => {
          const time = activeTimes[goal.key];
          const trap = goal.trapKey ? activeTimes[goal.trapKey] : goal.trapFallback;
          const hasTime = time !== undefined && time !== null && time > 0;
          
          return (
            <div key={goal.key} className="flex justify-between items-end border-b border-white/5 pb-2">
              <div>
                <span className="text-gray-400 text-xs sm:text-sm tracking-wider font-bold block">{goal.label}</span>
                {hasTime && trap && trap > 0 && (
                  <span className="text-[10px] text-cyan-400 font-bold tracking-wider">
                    TRAP: {Number(trap).toFixed(1)} {goal.unit || (isKph ? 'KM/H' : 'MPH')}
                  </span>
                )}
              </div>
              <AnimatePresence>
                {hasTime ? (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xl sm:text-2xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(0,255,136,0.3)]"
                  >
                    {formatTime(time)}
                  </motion.span>
                ) : (
                  <span className="text-xl sm:text-2xl font-black text-gray-700">--.---s</span>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Instructions & Staging Indicator */}
      <div className="bg-black/60 p-3 text-center text-[10px] text-gray-400 uppercase tracking-widest border-t border-white/5 flex items-center justify-center gap-1.5">
        <Zap size={11} className="text-emerald-400" />
        <span>Come to stop to Stage • Hard launch on throttle</span>
      </div>
    </Card>
  );
}
