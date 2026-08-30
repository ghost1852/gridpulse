import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';
import { Timer, Flag, MapPin, CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface LapTimerProps {
  currentLap: number;
  bestLap: number;
  lastLap: number;
  currentRaceTime?: number;
  lapNumber?: number;
  sprintStatus?: string;
  liveDeltaVsPb?: number | null;
  isArmed?: boolean;
  isDirty?: boolean;
  hasCustomGate?: boolean;
  onSetCustomGate?: () => void;
  onClearGate?: () => void;
}

export function LapTimer({ 
  currentLap, 
  bestLap, 
  lastLap, 
  lapNumber = 0,
  liveDeltaVsPb,
  isArmed,
  isDirty,
  hasCustomGate,
  onSetCustomGate,
  onClearGate
}: LapTimerProps) {
  
  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '--:--.---';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const frac = Math.floor((seconds % 1) * 1000);
    
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${frac.toString().padStart(3, '0')}`;
  };

  const isLapActive = currentLap > 0;
  const delta = lastLap > 0 && bestLap > 0 ? lastLap - bestLap : 0;
  const isFaster = delta < 0;

  return (
    <Card className="flex flex-col w-full overflow-hidden bg-[#0d0d14] border-white/10">
      {/* Top Status Bar: Mode, Live Delta, Gate Status */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/5 text-[10px] font-mono">
        <div className="flex items-center gap-1.5">
          {isDirty ? (
            <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
              <AlertTriangle size={10} />
              DIRTY (REWIND)
            </span>
          ) : isArmed ? (
            <span className="flex items-center gap-1 text-cyan-400 font-bold bg-cyan-400/10 px-1.5 py-0.5 rounded border border-cyan-400/20">
              <CheckCircle2 size={10} />
              GATE ARMED
            </span>
          ) : hasCustomGate ? (
            <span className="flex items-center gap-1 text-purple-400 font-bold bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">
              <MapPin size={10} />
              CUSTOM S/F GATE
            </span>
          ) : (
            <span className="text-gray-500 font-bold">TIME ATTACK / CIRCUIT</span>
          )}
        </div>

        {/* Live Delta vs PB */}
        {liveDeltaVsPb !== null && liveDeltaVsPb !== undefined && (
          <div className="flex items-center gap-1 font-bold font-mono">
            <span className="text-gray-400">DELTA:</span>
            <span className={cn(
              "text-xs px-1.5 py-0.2 rounded font-black",
              liveDeltaVsPb <= 0 ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"
            )}>
              {liveDeltaVsPb <= 0 ? '' : '+'}{liveDeltaVsPb.toFixed(2)}s
            </span>
          </div>
        )}

        {/* Set S/F Button */}
        {onSetCustomGate && (
          <div className="flex items-center gap-1">
            <button
              onClick={onSetCustomGate}
              className="flex items-center gap-1 text-[9px] bg-white/10 hover:bg-cyan-500/20 hover:text-cyan-400 px-2 py-0.5 rounded border border-white/10 font-bold transition"
              title="Set Start/Finish Line at current GPS position and heading"
            >
              <MapPin size={9} />
              SET S/F LINE
            </button>
            {hasCustomGate && onClearGate && (
              <button
                onClick={onClearGate}
                className="text-gray-500 hover:text-red-400 p-0.5"
                title="Clear custom gate"
              >
                <X size={10} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Lap Timing Metrics */}
      <div className="flex w-full">
        {/* Current Lap */}
        <div className="flex-1 p-2.5 sm:p-3.5 bg-white/5 border-r border-white/10 flex flex-col items-center justify-center relative">
          <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase font-bold mb-1 font-mono">
            <Timer size={12} className={isLapActive ? "text-emerald-400 animate-pulse" : "text-gray-500"} />
            <span>{isLapActive ? `Lap ${lapNumber > 0 ? `#${lapNumber}` : 'Timing'}` : 'Current Lap'}</span>
          </div>
          <span className={cn(
            "text-2xl sm:text-3xl font-mono font-black tracking-wider",
            isLapActive ? (isDirty ? "text-amber-400" : "text-white") : "text-gray-500"
          )}>
            {formatTime(currentLap)}
          </span>
        </div>
        
        {/* Best Lap */}
        <div className="flex-1 p-2.5 sm:p-3.5 bg-white/5 border-r border-white/10 flex flex-col items-center justify-center">
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 uppercase font-bold mb-1 font-mono">
            <Flag size={12} />
            <span>Best Lap</span>
          </div>
          <span className={cn(
            "text-xl sm:text-2xl font-mono font-black tracking-wider",
            bestLap > 0 ? "text-emerald-400" : "text-gray-500"
          )}>
            {formatTime(bestLap)}
          </span>
        </div>

        {/* Last Lap */}
        <div className="flex-1 p-2.5 sm:p-3.5 flex flex-col items-center justify-center relative">
          <span className="text-[10px] text-gray-400 uppercase font-bold mb-1 font-mono">Last Lap</span>
          <span className={cn(
            "text-xl sm:text-2xl font-mono font-bold tracking-wider",
            lastLap > 0 ? "text-white" : "text-gray-500"
          )}>
            {formatTime(lastLap)}
          </span>
          
          {lastLap > 0 && bestLap > 0 && (
            <span className={cn(
              "text-xs font-mono font-black mt-0.5",
              isFaster ? "text-emerald-400" : "text-red-400"
            )}>
              {isFaster ? '' : '+'}{delta.toFixed(3)}s
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
