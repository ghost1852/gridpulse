
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';

interface LapTimerProps {
  currentLap: number;
  bestLap: number;
  lastLap: number;
}

export function LapTimer({ currentLap, bestLap, lastLap }: LapTimerProps) {
  const formatTime = (ms: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const totalSeconds = ms; // assuming the data comes in seconds from telemetry, wait, usually it's seconds
    // Let's assume input is seconds for now
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    const frac = Math.floor((totalSeconds % 1) * 1000);
    
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${frac.toString().padStart(3, '0')}`;
  };

  const delta = lastLap > 0 && bestLap > 0 ? lastLap - bestLap : 0;
  const isFaster = delta < 0;

  return (
    <Card className="flex w-full overflow-hidden">
      <div className="flex-1 p-4 bg-white/5 border-r border-white/10 flex flex-col items-center justify-center">
        <span className="text-xs text-gray-400 uppercase font-bold mb-1">Current Lap</span>
        <span className="text-3xl font-mono font-bold text-white tracking-wider">{formatTime(currentLap)}</span>
      </div>
      
      <div className="flex-1 p-4 bg-white/5 border-r border-white/10 flex flex-col items-center justify-center">
        <span className="text-xs text-[var(--color-accent-primary)] uppercase font-bold mb-1">Best Lap</span>
        <span className="text-2xl font-mono font-bold text-white tracking-wider">{formatTime(bestLap)}</span>
      </div>

      <div className="flex-1 p-4 flex flex-col items-center justify-center relative">
        <span className="text-xs text-gray-400 uppercase font-bold mb-1">Last Lap</span>
        <span className="text-2xl font-mono font-bold text-white tracking-wider">{formatTime(lastLap)}</span>
        
        {lastLap > 0 && bestLap > 0 && (
          <span className={cn(
            "absolute bottom-2 right-4 text-sm font-mono font-bold",
            isFaster ? "text-[var(--color-accent-primary)]" : "text-[var(--color-accent-danger)]"
          )}>
            {isFaster ? '' : '+'}{delta.toFixed(3)}
          </span>
        )}
      </div>
    </Card>
  );
}
