import { Card } from '../ui/Card';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Activity } from 'lucide-react';

interface TireTempsProps {
  fl: number;
  fr: number;
  rl: number;
  rr: number;
  slipFl?: number;
  slipFr?: number;
  slipRl?: number;
  slipRr?: number;
  suspFl?: number;
  suspFr?: number;
  suspRl?: number;
  suspRr?: number;
}

export function TireTemps({ 
  fl, fr, rl, rr,
  slipFl = 0, slipFr = 0, slipRl = 0, slipRr = 0,
  suspFl = 0.5, suspFr = 0.5, suspRl = 0.5, suspRr = 0.5
}: TireTempsProps) {
  
  const getTempColor = (temp: number) => {
    if (temp < 150) return '#38bdf8'; // Cold - Sky Blue
    if (temp < 205) return '#10b981'; // Optimal Grip - Emerald
    if (temp < 240) return '#f59e0b'; // Warm - Amber
    return '#ef4444'; // Hot / Overheating - Red
  };

  const isDanger = (temp: number) => temp >= 235;

  const TirePod = ({ 
    temp, 
    slip, 
    susp, 
    label,
    isLeft = false
  }: { 
    temp: number; 
    slip: number; 
    susp: number; 
    label: string;
    isLeft?: boolean;
  }) => {
    const color = getTempColor(temp);
    const danger = isDanger(temp);
    const isSliding = slip > 0.8;
    const suspCompressionPct = Math.min(100, Math.max(0, (1.0 - susp) * 100));

    return (
      <div className={cn("flex items-center gap-1.5", isLeft ? "flex-row" : "flex-row-reverse")}>
        {/* Suspension Travel Indicator Bar */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-1.5 h-9 sm:h-12 bg-black/60 border border-white/10 rounded-full relative overflow-hidden flex flex-col justify-end">
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
            <span className="text-[9px] text-gray-400 font-bold font-mono uppercase">{label}</span>
            {isSliding && (
              <span className="text-[7px] font-mono font-bold text-amber-400 animate-pulse">SLIP</span>
            )}
          </div>

          <motion.div 
            className="w-11 sm:w-13 h-13 sm:h-16 rounded-lg border-2 relative overflow-hidden flex flex-col items-center justify-center bg-black/70 shadow-md"
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

            {/* Tire Temperature Value */}
            <span className="font-mono text-xs sm:text-sm font-black text-white z-10 tracking-tight">
              {Math.round(temp)}°
            </span>
            <span className="text-[7px] sm:text-[8px] font-mono text-gray-400 font-semibold z-10">FAHR</span>

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

  return (
    <Card className="p-2 sm:p-3 h-full flex flex-col justify-between relative overflow-hidden bg-[#0d0d14] border-white/10">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-1 mb-1 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-gray-400">
          <Activity size={12} className="text-emerald-400" />
          <span>TIRE THERMALS</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono">
          <span className="text-sky-400">COLD</span>
          <span className="text-emerald-400 font-bold">OPT</span>
          <span className="text-red-400">HOT</span>
        </div>
      </div>

      {/* 4 Corner Chassis Layout */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:gap-y-2 relative py-0.5 my-auto">
        {/* Front Axle */}
        <div className="flex justify-start">
          <TirePod temp={fl} slip={slipFl} susp={suspFl} label="FL" isLeft={true} />
        </div>
        <div className="flex justify-end">
          <TirePod temp={fr} slip={slipFr} susp={suspFr} label="FR" isLeft={false} />
        </div>

        {/* Rear Axle */}
        <div className="flex justify-start">
          <TirePod temp={rl} slip={slipRl} susp={suspRl} label="RL" isLeft={true} />
        </div>
        <div className="flex justify-end">
          <TirePod temp={rr} slip={slipRr} susp={suspRr} label="RR" isLeft={false} />
        </div>
      </div>
    </Card>
  );
}
