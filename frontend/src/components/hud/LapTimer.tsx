import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';
import { Timer, Flag, MapPin, CheckCircle2, AlertTriangle, Trash2, RotateCcw } from 'lucide-react';

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
  onResetLap?: () => void;
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
  onResetLap,
  onClearGate
}: LapTimerProps) {
  
  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0 || isNaN(seconds)) return '--:--.---';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const frac = Math.floor((seconds * 1000) % 1000);
    
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${frac.toString().padStart(3, '0')}`;
  };

  const isLapActive = currentLap > 0;
  const delta = (lastLap > 0 && bestLap > 0) ? (lastLap - bestLap) : null;
  const isFaster = delta !== null && delta < 0;

  return (
    <Card className="p-2 sm:p-3 h-full flex flex-col justify-between relative overflow-hidden bg-[#0d0d14] border-white/10">
      {/* Top Header: Title & Gate Status Badge */}
      <div className="flex justify-between items-center border-b border-white/5 pb-1 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-gray-300">
          <Timer size={13} className={isLapActive ? "text-cyan-400 animate-pulse" : "text-gray-400"} />
          <span>LAP TIMING</span>
        </div>

        <div>
          {isDirty ? (
            <span className="flex items-center gap-1 text-[8.5px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
              <AlertTriangle size={9} />
              DIRTY (REWIND)
            </span>
          ) : isArmed ? (
            <span className="flex items-center gap-1 text-[8.5px] text-cyan-300 font-bold bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30">
              <CheckCircle2 size={9} />
              GATE ARMED
            </span>
          ) : hasCustomGate ? (
            <span className="flex items-center gap-1 text-[8.5px] text-purple-300 font-bold bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/30">
              <MapPin size={9} />
              S/F ACTIVE
            </span>
          ) : (
            <span className="text-[8.5px] font-mono text-gray-500 font-bold">
              FREE ROAM
            </span>
          )}
        </div>
      </div>

      {/* Center: Running Lap Time & Live Delta */}
      <div className="flex-1 flex flex-col items-center justify-center py-1 my-auto">
        <div className="text-[8.5px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
          <span>CURRENT LAP</span>
          {lapNumber > 0 && <span className="text-cyan-400">#{lapNumber}</span>}
        </div>

        <div className={cn(
          "font-mono text-2xl sm:text-3xl font-black tracking-wider leading-none",
          isDirty ? "text-amber-400" : isLapActive ? "text-white" : "text-gray-400"
        )}>
          {formatTime(currentLap)}
        </div>

        {/* Live Delta vs PB */}
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <span className="text-[8px] font-mono text-gray-400 uppercase font-bold">DELTA</span>
          <span className={cn(
            "text-[10px] sm:text-[11px] font-mono font-black px-1.5 py-0.2 rounded",
            liveDeltaVsPb !== null && liveDeltaVsPb !== undefined
              ? (liveDeltaVsPb <= 0 ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20" : "text-red-400 bg-red-400/10 border border-red-400/20")
              : (delta === null ? "text-gray-500" : isFaster ? "text-emerald-400" : "text-red-400")
          )}>
            {liveDeltaVsPb !== null && liveDeltaVsPb !== undefined
              ? `${liveDeltaVsPb <= 0 ? '' : '+'}${liveDeltaVsPb.toFixed(2)}s`
              : (delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}s` : '--.---')}
          </span>
        </div>
      </div>

      {/* Best & Last Lap Stats Bar */}
      <div className="grid grid-cols-2 gap-1 py-1 border-t border-white/5 font-mono text-center shrink-0">
        <div className="bg-black/30 rounded-lg py-0.5 px-1 border border-white/5">
          <div className="text-[7.5px] text-emerald-400 font-bold uppercase flex items-center justify-center gap-0.5">
            <Flag size={8} />
            <span>BEST</span>
          </div>
          <div className="text-[10px] sm:text-[11px] font-black text-white">
            {bestLap > 0 ? formatTime(bestLap) : '--:--.---'}
          </div>
        </div>

        <div className="bg-black/30 rounded-lg py-0.5 px-1 border border-white/5">
          <div className="text-[7.5px] text-gray-400 font-bold uppercase">
            LAST
          </div>
          <div className="text-[10px] sm:text-[11px] font-bold text-gray-300">
            {lastLap > 0 ? formatTime(lastLap) : '--:--.---'}
          </div>
        </div>
      </div>

      {/* Action Buttons: 3 Clearly Distinct Operations */}
      <div className="pt-1.5 shrink-0">
        {hasCustomGate ? (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              {onResetLap && (
                <button
                  type="button"
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    onResetLap();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetLap();
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 active:bg-cyan-500/50 text-cyan-200 hover:text-white border border-cyan-500/40 text-[11px] font-mono font-bold transition-all cursor-pointer select-none active:scale-95 shadow-[0_0_10px_rgba(6,182,212,0.15)] touch-manipulation"
                  title="Reset active lap timer to 0 and re-arm gate (keeps gate intact)"
                >
                  <RotateCcw size={11} className="text-cyan-300" />
                  <span>RESET LAP</span>
                </button>
              )}
              {onSetCustomGate && (
                <button
                  type="button"
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    onSetCustomGate();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetCustomGate();
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 active:bg-purple-500/50 text-purple-200 hover:text-white border border-purple-500/40 text-[11px] font-mono font-bold transition-all cursor-pointer select-none active:scale-95 shadow-[0_0_10px_rgba(168,85,247,0.15)] touch-manipulation"
                  title="Move Start/Finish Line to vehicle's current GPS position"
                >
                  <MapPin size={11} className="text-purple-300" />
                  <span>MOVE S/F</span>
                </button>
              )}
            </div>

            {onClearGate && (
              <button
                type="button"
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  onClearGate();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearGate();
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-red-500/15 hover:bg-red-500/30 active:bg-red-500/40 text-red-300 hover:text-red-100 border border-red-500/30 text-[10.5px] font-mono font-bold transition-all cursor-pointer select-none active:scale-95 touch-manipulation"
                title="Clear Start/Finish Gate and return to Free Roam"
              >
                <Trash2 size={11} className="text-red-400" />
                <span>CLEAR S/F GATE</span>
              </button>
            )}
          </div>
        ) : (
          onSetCustomGate && (
            <button
              type="button"
              onTouchEnd={(e) => {
                e.stopPropagation();
                onSetCustomGate();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSetCustomGate();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:bg-emerald-500/45 text-emerald-300 hover:text-emerald-100 border border-emerald-500/50 text-xs font-mono font-black tracking-wider transition-all cursor-pointer select-none active:scale-95 shadow-[0_0_15px_rgba(0,255,136,0.2)] touch-manipulation"
              title="Set Start/Finish Gate at current GPS location"
            >
              <MapPin size={14} className="text-emerald-400" />
              <span>SET S/F LINE</span>
            </button>
          )
        )}
      </div>
    </Card>
  );
}
