import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';
import { Timer, Flag } from 'lucide-react';

interface LapTimerProps {
  currentLap: number;
  bestLap: number;
  lastLap: number;
  currentRaceTime?: number;
  lapNumber?: number;
}

export function LapTimer({ 
  currentLap, 
  bestLap, 
  lastLap, 
  currentRaceTime = 0, 
  lapNumber = 0 
}: LapTimerProps) {
  
  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '--:--.---';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const frac = Math.floor((seconds % 1) * 1000);
    
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${frac.toString().padStart(3, '0')}`;
  };

  // Determine active display time: prioritizes CurrentLap, falls back to CurrentRaceTime if in timed sprint
  const activeTime = currentLap > 0 ? currentLap : (currentRaceTime > 0 ? currentRaceTime : 0);
  const delta = lastLap > 0 && bestLap > 0 ? lastLap - bestLap : 0;
  const isFaster = delta < 0;

  return (
    <Card className="flex w-full overflow-hidden bg-[#0d0d14] border-white/10">
      {/* Current Lap / Event Time */}
      <div className="flex-1 p-3 sm:p-4 bg-white/5 border-r border-white/10 flex flex-col items-center justify-center relative">
        <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase font-bold mb-1 font-mono">
          <Timer size={12} className="text-cyan-400" />
          <span>{currentLap > 0 ? `Current Lap ${lapNumber > 0 ? `#${lapNumber}` : ''}` : (currentRaceTime > 0 ? 'Race Time' : 'Current Lap')}</span>
        </div>
        <span className="text-2xl sm:text-3xl font-mono font-black text-white tracking-wider">
          {formatTime(activeTime)}
        </span>
      </div>
      
      {/* Best Lap */}
      <div className="flex-1 p-3 sm:p-4 bg-white/5 border-r border-white/10 flex flex-col items-center justify-center">
        <div className="flex items-center gap-1 text-[10px] text-emerald-400 uppercase font-bold mb-1 font-mono">
          <Flag size={12} />
          <span>Best Lap</span>
        </div>
        <span className="text-xl sm:text-2xl font-mono font-black text-emerald-400 tracking-wider">
          {formatTime(bestLap)}
        </span>
      </div>

      {/* Last Lap */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col items-center justify-center relative">
        <span className="text-[10px] text-gray-400 uppercase font-bold mb-1 font-mono">Last Lap</span>
        <span className="text-xl sm:text-2xl font-mono font-bold text-white tracking-wider">
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
    </Card>
  );
}
