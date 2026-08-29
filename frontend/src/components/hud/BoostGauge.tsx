import { Card } from '../ui/Card';
import { useUnits } from '../../context/UnitContext';
import { cn } from '../../lib/utils';
import { Gauge } from 'lucide-react';
import { motion } from 'framer-motion';

interface BoostGaugeProps {
  boostPsi: number;
  maxBoostPsi?: number;
  className?: string;
  compact?: boolean;
}

export function BoostGauge({ 
  boostPsi, 
  maxBoostPsi = 30, 
  className,
  compact = false 
}: BoostGaugeProps) {
  const { convertPressure, toggleUnit } = useUnits();

  // Converted current boost and label
  const { value: currentVal, label: unitLabel } = convertPressure(boostPsi);

  // Vacuum vs Positive Boost detection
  const isVacuum = boostPsi < 0;
  const isHighBoost = boostPsi > 18;

  // Normalized gauge position: -14.7 PSI to +maxBoostPsi
  const minVal = -14.7;
  const range = maxBoostPsi - minVal;
  const normalizedPct = Math.min(100, Math.max(0, ((boostPsi - minVal) / range) * 100));

  if (compact) {
    return (
      <div 
        onClick={() => toggleUnit('pressure')}
        className={cn(
          "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/10 hover:border-cyan-400/40 cursor-pointer transition-all",
          className
        )}
        title="Click to toggle PSI / BAR / KPA"
      >
        <div className="flex items-center gap-1.5">
          <Gauge size={13} className={cn(isVacuum ? "text-gray-400" : isHighBoost ? "text-rose-400" : "text-cyan-400")} />
          <span className="text-[9px] font-mono font-bold text-gray-400 uppercase">BOOST</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn(
            "text-xs font-mono font-black",
            isVacuum ? "text-gray-300" : isHighBoost ? "text-rose-400" : "text-cyan-300"
          )}>
            {currentVal > 0 ? `+${currentVal}` : `${currentVal}`}
          </span>
          <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">{unitLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(
      "p-3 flex flex-col justify-between bg-[#0d0d14] border-white/10 relative overflow-hidden",
      isHighBoost ? "border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]" : "",
      className
    )}>
      {/* Top Header with Unit Toggle */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5">
          <Gauge size={14} className={isHighBoost ? "text-rose-400 animate-pulse" : "text-cyan-400"} />
          <span className="text-[10px] font-mono font-bold text-gray-300 uppercase tracking-wider">
            BOOST / VACUUM
          </span>
        </div>

        <button
          onClick={() => toggleUnit('pressure')}
          className="px-2 py-0.5 rounded bg-black/60 border border-white/10 hover:border-cyan-400 text-[9px] font-mono font-black text-cyan-400 transition-colors cursor-pointer"
          title="Toggle Unit: PSI / BAR / KPA"
        >
          {unitLabel} ⇄
        </button>
      </div>

      {/* Main Boost Dial & Digital Readout */}
      <div className="flex items-center justify-center my-2 relative">
        <svg viewBox="0 0 100 65" className="w-32 h-20 overflow-visible">
          {/* Background Arc */}
          <path
            d="M 15 55 A 40 40 0 1 1 85 55"
            fill="none"
            stroke="#1a1a24"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Vacuum Sector (Left Arc) */}
          <path
            d="M 15 55 A 40 40 0 0 1 35 22"
            fill="none"
            stroke="#374151"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Active Boost Arc Fill */}
          <motion.path
            d="M 15 55 A 40 40 0 1 1 85 55"
            fill="none"
            stroke={isHighBoost ? "#f43f5e" : "#06b6d4"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="180"
            strokeDashoffset={180 - (normalizedPct / 100) * 180}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            style={{
              filter: isHighBoost ? 'drop-shadow(0 0 6px #f43f5e)' : 'drop-shadow(0 0 6px #06b6d4)'
            }}
          />

          {/* Center Zero Tick */}
          <line x1="35" y1="22" x2="33" y2="17" stroke="#9ca3af" strokeWidth="1.5" />
        </svg>

        {/* Digital Pressure Number */}
        <div className="absolute top-10 flex flex-col items-center">
          <div className="flex items-baseline gap-0.5">
            <span className={cn(
              "text-2xl font-mono font-black tracking-tight",
              isVacuum ? "text-gray-400" : isHighBoost ? "text-rose-400" : "text-cyan-300"
            )}>
              {currentVal > 0 ? `+${currentVal}` : `${currentVal}`}
            </span>
          </div>
          <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest">
            {unitLabel}
          </span>
        </div>
      </div>

      {/* Bottom Bar: Vacuum vs Positive Boost status */}
      <div className="flex items-center justify-between text-[9px] font-mono text-gray-400 pt-1 border-t border-white/5 z-10">
        <span className={cn(isVacuum ? "text-amber-400 font-bold" : "text-gray-500")}>
          VACUUM
        </span>
        <span className={cn(!isVacuum && boostPsi > 1 ? "text-cyan-400 font-bold" : "text-gray-500")}>
          BOOST FLOW
        </span>
      </div>
    </Card>
  );
}
