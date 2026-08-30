import { useState } from 'react';
import { Card } from '../ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Activity, Timer, X, Sparkles } from 'lucide-react';
import { useUnits } from '../../context/UnitContext';

interface TireTempsProps {
  fl: number;
  fr: number;
  rl: number;
  rr: number;
  slipFl?: number;
  slipFr?: number;
  slipRl?: number;
  slipRr?: number;
  slipAngleFl?: number;
  slipAngleFr?: number;
  slipAngleRl?: number;
  slipAngleRr?: number;
  suspFl?: number;
  suspFr?: number;
  suspRl?: number;
  suspRr?: number;
  currentLap?: number;
  bestLap?: number;
  lastLap?: number;
  lapNumber?: number;
  liveDeltaVsPb?: number | null;
  isArmed?: boolean;
  isDirty?: boolean;
  hasCustomGate?: boolean;
  onSetCustomGate?: () => void;
}

export function TireTemps({ 
  fl, fr, rl, rr,
  slipFl = 0, slipFr = 0, slipRl = 0, slipRr = 0,
  slipAngleFl = 0, slipAngleFr = 0, slipAngleRl = 0, slipAngleRr = 0,
  suspFl = 0.5, suspFr = 0.5, suspRl = 0.5, suspRr = 0.5,
  currentLap = 0,
  bestLap = 0,
  lastLap = 0,
  lapNumber = 0,
  liveDeltaVsPb,
  isDirty,
  hasCustomGate,
  onSetCustomGate
}: TireTempsProps) {
  const { convertTemp } = useUnits();
  const [inspectedCorner, setInspectedCorner] = useState<'FL' | 'FR' | 'RL' | 'RR' | null>(null);
  
  const getTempColor = (tempF: number) => {
    if (tempF < 150) return '#38bdf8'; // Cold - Sky Blue
    if (tempF < 205) return '#10b981'; // Optimal Grip - Emerald
    if (tempF < 240) return '#f59e0b'; // Warm - Amber
    return '#ef4444'; // Hot / Overheating - Red
  };

  const isDanger = (tempF: number) => tempF >= 235;

  const formatLapTime = (seconds: number) => {
    if (!seconds || seconds <= 0 || isNaN(seconds)) return '--:--.---';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds * 1000) % 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const delta = (currentLap > 0 && bestLap > 0) ? (currentLap - bestLap) : null;
  const isDeltaFaster = delta !== null && delta < 0;

  const getCornerData = (corner: 'FL' | 'FR' | 'RL' | 'RR') => {
    switch (corner) {
      case 'FL': return { temp: fl, slip: slipFl, angle: slipAngleFl, susp: suspFl, label: 'Front Left' };
      case 'FR': return { temp: fr, slip: slipFr, angle: slipAngleFr, susp: suspFr, label: 'Front Right' };
      case 'RL': return { temp: rl, slip: slipRl, angle: slipAngleRl, susp: suspRl, label: 'Rear Left' };
      case 'RR': return { temp: rr, slip: slipRr, angle: slipAngleRr, susp: suspRr, label: 'Rear Right' };
    }
  };

  const TirePod = ({ 
    corner,
    temp, 
    slip, 
    susp, 
    isLeft = false
  }: { 
    corner: 'FL' | 'FR' | 'RL' | 'RR';
    temp: number; 
    slip: number; 
    susp: number; 
    isLeft?: boolean;
  }) => {
    const color = getTempColor(temp);
    const danger = isDanger(temp);
    const isSliding = slip > 0.8;
    const suspCompressionPct = Math.min(100, Math.max(0, (1.0 - susp) * 100));
    const converted = convertTemp(temp);
    return (
      <div 
        role="button"
        tabIndex={0}
        onPointerDown={() => setInspectedCorner(corner)}
        onClick={() => setInspectedCorner(corner)}
        className={cn(
          "flex items-center gap-1.5 cursor-pointer group active:scale-95 transition-transform select-none touch-manipulation", 
          isLeft ? "flex-row" : "flex-row-reverse"
        )}
      >
        {/* Suspension Travel Bar */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-1.5 h-10 sm:h-12 bg-black/60 border border-white/10 rounded-full relative overflow-hidden flex flex-col justify-end">
            <motion.div 
              className={cn(
                "w-full rounded-full transition-all duration-75",
                suspCompressionPct > 85 ? "bg-red-500" : suspCompressionPct > 60 ? "bg-amber-400" : "bg-emerald-400"
              )}
              style={{ height: `${suspCompressionPct}%` }}
            />
          </div>
          <span className="text-[7px] font-mono text-gray-500 font-bold">SUS</span>
        </div>

        {/* Tire Pod */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center justify-between w-full px-0.5">
            <span className="text-[9px] text-gray-400 font-bold font-mono uppercase group-hover:text-cyan-300 transition-colors">
              {corner}
            </span>
            {isSliding && (
              <span className="text-[7px] font-mono font-bold text-amber-400 animate-pulse">SLIP</span>
            )}
          </div>

          <motion.div 
            className="w-12 sm:w-14 h-14 sm:h-16 rounded-xl border-2 relative overflow-hidden flex flex-col items-center justify-center bg-black/80 shadow-md transition-all group-hover:border-cyan-400"
            style={{ borderColor: color }}
            animate={danger ? { 
              boxShadow: [`0 0 0px ${color}`, `0 0 12px ${color}`, `0 0 0px ${color}`]
            } : isSliding ? {
              boxShadow: `0 0 10px rgba(245,158,11,0.6)`
            } : {}}
            transition={danger ? { repeat: Infinity, duration: 0.4 } : {}}
          >
            {/* Heat Gradient Fill */}
            <div 
              className="absolute inset-0 opacity-25" 
              style={{ backgroundColor: color }} 
            />

            {/* Tire Temperature Value & Status */}
            <span className="font-mono text-sm sm:text-base font-black text-white z-10 tracking-tight">
              {converted.value}°
            </span>
            <span 
              className="text-[6.5px] font-mono font-bold px-1 py-0.2 rounded z-10 uppercase mt-0.5"
              style={{
                backgroundColor: `${color}25`,
                color: color
              }}
            >
              {temp < 150 ? 'COLD' : temp < 205 ? 'OPTIMAL' : temp < 240 ? 'WARM' : 'HOT'}
            </span>

            {/* Bottom Grip / Slip Meter */}
            <div className="absolute bottom-0.5 inset-x-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-100",
                  slip > 1.2 ? "bg-red-500" : slip > 0.6 ? "bg-amber-400" : "bg-emerald-400"
                )}
                style={{ width: `${Math.min(100, slip * 50)}%` }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  const inspectedData = inspectedCorner ? getCornerData(inspectedCorner) : null;

  return (
    <Card className="p-2 sm:p-3 h-full flex flex-col justify-between relative overflow-hidden bg-[#0d0d14] border-white/10">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-1 mb-1 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-gray-400">
          <Activity size={12} className="text-emerald-400" />
          <span>TIRE THERMALS &amp; LAP TIMING</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-gray-500">
          <span className="text-cyan-400">TAP TIRE FOR TELEMETRY</span>
        </div>
      </div>

      {/* 4 Corner Chassis Layout with Center Lap Timer */}
      <div className="grid grid-cols-3 items-center gap-2 relative py-1 my-auto">
        
        {/* Left Column: Front Left & Rear Left Tires */}
        <div className="flex flex-col items-start gap-2 sm:gap-3">
          <TirePod corner="FL" temp={fl} slip={slipFl} susp={suspFl} isLeft={true} />
          <TirePod corner="RL" temp={rl} slip={slipRl} susp={suspRl} isLeft={true} />
        </div>

        {/* Center Column: High-Precision Compact Lap Timer Module */}
        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-black/60 border border-white/10 shadow-inner h-full min-h-[120px] text-center">
          <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-mono font-bold text-cyan-400 uppercase mb-0.5">
            <Timer size={10} />
            <span>CURRENT LAP</span>
          </div>

          {/* Current Lap Time */}
          <div className={cn(
            "font-mono text-base sm:text-lg font-black tracking-wider leading-none",
            isDirty ? "text-amber-400" : "text-white"
          )}>
            {formatLapTime(currentLap)}
          </div>

          {/* Delta vs PB / Best Lap */}
          <div className="mt-1 flex items-center justify-center gap-1">
            <span className="text-[7px] sm:text-[8px] font-mono text-gray-400 uppercase">DELTA</span>
            <span className={cn(
              "text-[9px] sm:text-[10px] font-mono font-black px-1 rounded",
              liveDeltaVsPb !== null && liveDeltaVsPb !== undefined
                ? (liveDeltaVsPb <= 0 ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10")
                : (delta === null ? "text-gray-500" : isDeltaFaster ? "text-emerald-400" : "text-red-400")
            )}>
              {liveDeltaVsPb !== null && liveDeltaVsPb !== undefined
                ? `${liveDeltaVsPb <= 0 ? '' : '+'}${liveDeltaVsPb.toFixed(2)}s`
                : (delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}s` : '--.---')}
            </span>
          </div>

          {/* Best Lap & Gate Status */}
          <div className="mt-1.5 pt-1 border-t border-white/10 w-full flex flex-col items-center">
            <span className="text-[7px] sm:text-[8px] font-mono font-bold text-emerald-400 uppercase">
              BEST {bestLap > 0 ? formatLapTime(bestLap) : '--:--.---'}
            </span>
            {lastLap > 0 && (
              <span className="text-[7px] font-mono text-gray-400">
                LAST {formatLapTime(lastLap)}
              </span>
            )}
            {lapNumber > 0 && (
              <span className="text-[7px] font-mono text-gray-400 mt-0.5 font-bold">
                LAP {lapNumber}
              </span>
            )}

            {/* S/F Gate Pill */}
            {onSetCustomGate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetCustomGate();
                }}
                className="mt-1 text-[7px] font-mono bg-white/10 hover:bg-cyan-500/20 text-gray-300 hover:text-cyan-400 px-1.5 py-0.5 rounded font-bold transition"
                title="Set Start/Finish Gate at current GPS location"
              >
                {hasCustomGate ? 'RESET S/F' : 'SET S/F'}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Front Right & Rear Right Tires */}
        <div className="flex flex-col items-end gap-2 sm:gap-3">
          <TirePod corner="FR" temp={fr} slip={slipFr} susp={suspFr} isLeft={false} />
          <TirePod corner="RR" temp={rr} slip={slipRr} susp={suspRr} isLeft={false} />
        </div>

      </div>

      {/* Interactive Corner Inspection Modal / Drawer */}
      <AnimatePresence>
        {inspectedCorner && inspectedData && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-0 bg-black/95 backdrop-blur-md z-30 p-3 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-cyan-400" />
                <h4 className="text-xs font-mono font-black text-white uppercase tracking-wider">
                  {inspectedData.label} ({inspectedCorner}) Telemetry
                </h4>
              </div>
              <button
                onClick={() => setInspectedCorner(null)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 my-auto">
              <div className="bg-[#12121c] border border-white/10 rounded-lg p-2 flex flex-col">
                <span className="text-[8px] font-mono text-gray-400 uppercase">TIRE TEMPERATURE</span>
                <span className="text-sm font-mono font-black text-white mt-0.5">
                  {convertTemp(inspectedData.temp).value}{convertTemp(inspectedData.temp).label}
                </span>
              </div>

              <div className="bg-[#12121c] border border-white/10 rounded-lg p-2 flex flex-col">
                <span className="text-[8px] font-mono text-gray-400 uppercase">SLIP RATIO</span>
                <span className="text-sm font-mono font-black text-white mt-0.5">
                  {inspectedData.slip.toFixed(3)}
                </span>
              </div>

              <div className="bg-[#12121c] border border-white/10 rounded-lg p-2 flex flex-col">
                <span className="text-[8px] font-mono text-gray-400 uppercase">SLIP ANGLE</span>
                <span className="text-sm font-mono font-black text-white mt-0.5">
                  {(inspectedData.angle * (180 / Math.PI)).toFixed(1)}°
                </span>
              </div>

              <div className="bg-[#12121c] border border-white/10 rounded-lg p-2 flex flex-col">
                <span className="text-[8px] font-mono text-gray-400 uppercase">SUSPENSION TRAVEL</span>
                <span className="text-sm font-mono font-black text-white mt-0.5">
                  {Math.round((1.0 - inspectedData.susp) * 100)}% comp
                </span>
              </div>
            </div>

            <div className="text-[9px] font-mono text-gray-500 text-center">
              Real-time per-wheel physics streaming at 60Hz
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
