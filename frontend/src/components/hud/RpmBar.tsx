import { Card } from '../ui/Card';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface RpmBarProps {
  currentRpm: number;
  maxRpm: number;
  gear: number;
  clutch?: number;
}

export function RpmBar({ currentRpm, maxRpm, gear, clutch = 0 }: RpmBarProps) {
  const safeMax = maxRpm > 0 ? maxRpm : 8500;
  const percentage = Math.min(100, Math.max(0, (currentRpm / safeMax) * 100));
  
  const isShiftPoint = percentage >= 92;
  const isRedline = percentage >= 97;

  // 16 Discrete Shift Light LEDs
  const TOTAL_LEDS = 16;
  const activeLeds = Math.floor((percentage / 100) * TOTAL_LEDS);

  const getLedColor = (index: number) => {
    if (index < 6) return '#00ff88'; // Green (1-6)
    if (index < 11) return '#f59e0b'; // Amber (7-11)
    if (index < 14) return '#ef4444'; // Red (12-14)
    return '#ec4899'; // Magenta / Shift (15-16)
  };

  const displayGear = gear === 0 ? 'R' : gear > 0 ? gear : 'N';

  return (
    <Card className={cn(
      "p-5 flex flex-col gap-3 relative overflow-hidden transition-all duration-150",
      isRedline ? "border-pink-500/80 shadow-[0_0_25px_rgba(236,72,153,0.3)]" : isShiftPoint ? "border-red-500/60" : "border-white/10"
    )}>
      {/* Redline Screen Flash */}
      {isRedline && (
        <motion.div 
          className="absolute inset-0 bg-pink-500/15 pointer-events-none z-0"
          animate={{ opacity: [0.2, 0.9, 0.2] }}
          transition={{ repeat: Infinity, duration: 0.12 }}
        />
      )}

      {/* Top Row: F1 / GT3 Shift Light LED Bar */}
      <div className="flex items-center justify-between gap-1 px-1 z-10">
        <div className="flex items-center gap-1.5 flex-1 justify-between">
          {Array.from({ length: TOTAL_LEDS }).map((_, idx) => {
            const isActive = idx < activeLeds;
            const ledColor = getLedColor(idx);
            return (
              <div 
                key={idx}
                className={cn(
                  "flex-1 h-3.5 rounded-sm transition-all duration-75 border",
                  isActive ? "border-transparent" : "border-white/10 bg-white/5"
                )}
                style={{
                  backgroundColor: isActive ? ledColor : undefined,
                  boxShadow: isActive ? `0 0 10px ${ledColor}` : undefined,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Middle Row: Big Gear + Dynamic Sweep Tachometer */}
      <div className="flex items-center gap-5 z-10">
        {/* Massive Gear Box */}
        <div className="flex flex-col items-center justify-center bg-black/60 border border-white/10 rounded-lg w-20 h-20 shrink-0 relative overflow-hidden shadow-inner">
          <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 absolute top-1">GEAR</span>
          <span className={cn(
            "text-5xl font-mono font-black italic mt-2",
            isRedline ? "text-pink-400 animate-pulse" : displayGear === 'R' ? "text-yellow-400" : "text-white"
          )}>
            {displayGear}
          </span>
          {clutch > 10 && (
            <span className="absolute bottom-1 text-[9px] font-mono font-bold text-amber-400">CLUTCH</span>
          )}
        </div>

        {/* Tachometer Bar & Values */}
        <div className="flex-1 flex flex-col gap-1.5 justify-center">
          <div className="flex justify-between items-end text-xs font-mono">
            <span className="text-gray-400 font-bold tracking-wider">
              {isRedline ? (
                <span className="text-pink-400 font-black animate-pulse">SHIFT NOW</span>
              ) : isShiftPoint ? (
                <span className="text-red-400 font-bold">OPTIMAL SHIFT</span>
              ) : (
                <span>ENGINE RPM</span>
              )}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-mono font-bold text-white tracking-tight">
                {Math.round(currentRpm).toLocaleString()}
              </span>
              <span className="text-[10px] text-gray-500 font-mono">/ {Math.round(safeMax).toLocaleString()}</span>
            </div>
          </div>

          {/* Continuous Gradient Bar */}
          <div className="h-6 bg-black/50 border border-white/10 rounded-md relative overflow-hidden p-0.5">
            {/* Scale Markers */}
            <div className="absolute inset-0 flex justify-between px-2 items-center opacity-30 pointer-events-none z-20">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                <div key={i} className="w-[1px] h-full bg-white" />
              ))}
            </div>

            <motion.div
              className="h-full rounded-sm bg-gradient-to-r from-emerald-500 via-amber-400 via-75% via-red-500 to-pink-500"
              initial={{ width: '0%' }}
              animate={{ width: `${percentage}%` }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              style={{
                boxShadow: isShiftPoint ? '0 0 15px rgba(239,68,68,0.5)' : undefined
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
