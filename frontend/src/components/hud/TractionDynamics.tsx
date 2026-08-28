import { useMemo } from 'react';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';
import { Gauge, Zap, AlertTriangle, Disc, Flame, Snowflake, ArrowLeftRight } from 'lucide-react';
import { useUnits } from '../../context/UnitContext';

interface TractionDynamicsProps {
  slipAngleFl?: number;
  slipAngleFr?: number;
  slipAngleRl?: number;
  slipAngleRr?: number;
  slipRatioFl?: number;
  slipRatioFr?: number;
  slipRatioRl?: number;
  slipRatioRr?: number;
  tireTempFl: number;
  tireTempFr: number;
  tireTempRl: number;
  tireTempRr: number;
  accelX: number;
  accelZ: number;
  throttle: number;
  brake: number;
  suspFl?: number;
  suspFr?: number;
  suspRl?: number;
  suspRr?: number;
}

export function TractionDynamics({
  slipAngleFl = 0,
  slipAngleFr = 0,
  slipAngleRl = 0,
  slipAngleRr = 0,
  slipRatioFl = 0,
  slipRatioFr = 0,
  slipRatioRl = 0,
  slipRatioRr = 0,
  tireTempFl,
  tireTempFr,
  tireTempRl,
  tireTempRr,
  accelX,
  accelZ,
  throttle,
  brake,
  suspFl = 0.5,
  suspFr = 0.5,
  suspRl = 0.5,
  suspRr = 0.5,
}: TractionDynamicsProps) {
  const { convertTemp } = useUnits();

  // 1. Traction Utilization (0-100% of G-envelope)
  const tractionG = Math.sqrt(accelX * accelX + accelZ * accelZ);
  // Estimated peak tire grip capability based on car class (~1.8G - 2.5G peak)
  const maxEstimatedG = 2.4;
  const tractionPct = Math.min(100, Math.round((tractionG / maxEstimatedG) * 100));

  // 2. Understeer vs Oversteer Dynamics
  // Front slip angle avg vs Rear slip angle avg
  const frontSlipAvg = (Math.abs(slipAngleFl) + Math.abs(slipAngleFr)) / 2.0;
  const rearSlipAvg = (Math.abs(slipAngleRl) + Math.abs(slipAngleRr)) / 2.0;
  const handlingDelta = rearSlipAvg - frontSlipAvg; // > 0 = Oversteer / Drift, < 0 = Understeer

  const handlingState = useMemo(() => {
    if (Math.abs(accelX) < 0.25 && frontSlipAvg < 0.05 && rearSlipAvg < 0.05) {
      return { label: 'BALANCED', color: 'text-emerald-400', barPct: 50 };
    }
    if (handlingDelta < -0.06) {
      const severity = Math.min(50, Math.round(Math.abs(handlingDelta) * 400));
      return { label: 'UNDERSTEER', color: 'text-amber-400', barPct: 50 - severity };
    }
    if (handlingDelta > 0.08) {
      const severity = Math.min(50, Math.round(handlingDelta * 400));
      return { label: 'OVERSTEER', color: 'text-cyan-400', barPct: 50 + severity };
    }
    return { label: 'NEUTRAL', color: 'text-emerald-400', barPct: 50 };
  }, [handlingDelta, accelX, frontSlipAvg, rearSlipAvg]);

  // 3. Wheelspin Detection (Slip Ratio > 1.15 under throttle > 30%)
  const hasWheelspin = throttle > 70 && (
    Math.abs(slipRatioFl) > 1.15 || 
    Math.abs(slipRatioFr) > 1.15 || 
    Math.abs(slipRatioRl) > 1.15 || 
    Math.abs(slipRatioRr) > 1.15
  );

  // 4. Brake Lockup Detection (Brake > 60 and high negative slip or wheel stopped)
  const hasLockup = brake > 80 && (
    Math.abs(slipRatioFl) > 1.3 || 
    Math.abs(slipRatioFr) > 1.3 || 
    Math.abs(slipRatioRl) > 1.3 || 
    Math.abs(slipRatioRr) > 1.3
  );

  // 5. Thermal Conditions
  const minTemp = Math.min(tireTempFl, tireTempFr, tireTempRl, tireTempRr);
  const maxTemp = Math.max(tireTempFl, tireTempFr, tireTempRl, tireTempRr);
  const isCold = minTemp < 135;
  const isOverheating = maxTemp > 235;

  // 6. Suspension Bottoming (< 4% travel remaining)
  const isBottoming = suspFl < 0.04 || suspFr < 0.04 || suspRl < 0.04 || suspRr < 0.04;

  return (
    <Card className="p-2 sm:p-3 landscape:p-2 bg-[#0e0e16]/90 border-white/10 space-y-1.5 sm:space-y-2">
      {/* Top Header: Handling Dynamics & Traction */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-mono font-bold text-gray-300">
          <ArrowLeftRight size={13} className="text-cyan-400" />
          <span>CHASSIS BALANCE</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs font-black">
          <span className={handlingState.color}>{handlingState.label}</span>
        </div>
      </div>

      {/* Understeer / Oversteer Dynamic Meter */}
      <div className="space-y-0.5">
        <div className="relative h-1.5 sm:h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/30 z-10 -translate-x-1/2" />
          {/* Indicator cursor */}
          <div 
            className="absolute top-0 bottom-0 w-4 rounded-full transition-all duration-75 -translate-x-1/2"
            style={{ 
              left: `${Math.max(5, Math.min(95, handlingState.barPct))}%`,
              backgroundColor: handlingState.barPct < 45 ? '#fbbf24' : (handlingState.barPct > 55 ? '#22d3ee' : '#10b981')
            }}
          />
        </div>
        <div className="flex justify-between text-[8px] sm:text-[9px] font-mono font-bold text-gray-500">
          <span className="text-amber-400/80">◄ UNDERSTEER (PUSH)</span>
          <span className="text-emerald-400/80">BALANCED</span>
          <span className="text-cyan-400/80">OVERSTEER (SLIP) ►</span>
        </div>
      </div>

      {/* Bottom Grid: Traction Utilization + Real-time Telemetry Flags */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
        {/* Traction Utilization */}
        <div className="bg-black/30 p-2 rounded-lg border border-white/5 space-y-1">
          <div className="flex justify-between text-[10px] font-mono font-bold text-gray-400">
            <span className="flex items-center gap-1">
              <Gauge size={11} className="text-emerald-400" />
              TRACTION GRIP
            </span>
            <span className="text-white font-black">{tractionPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-75 rounded-full",
                tractionPct > 90 ? "bg-red-500" : (tractionPct > 75 ? "bg-amber-400" : "bg-emerald-400")
              )}
              style={{ width: `${tractionPct}%` }}
            />
          </div>
        </div>

        {/* Live Physics Status Flags */}
        <div className="bg-black/30 p-1.5 rounded-lg border border-white/5 flex flex-wrap items-center gap-1.5">
          {hasWheelspin && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[9px] font-mono font-black text-amber-300 flex items-center gap-1 animate-pulse">
              <Zap size={10} /> WHEELSPIN
            </span>
          )}
          {hasLockup && (
            <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-[9px] font-mono font-black text-red-300 flex items-center gap-1 animate-pulse">
              <Disc size={10} /> LOCKUP
            </span>
          )}
          {isOverheating && (
            <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-[9px] font-mono font-black text-red-400 flex items-center gap-1">
              <Flame size={10} /> HOT ({convertTemp(maxTemp).value}{convertTemp(maxTemp).label})
            </span>
          )}
          {isCold && (
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-[9px] font-mono font-black text-cyan-300 flex items-center gap-1">
              <Snowflake size={10} /> COLD ({convertTemp(minTemp).value}{convertTemp(minTemp).label})
            </span>
          )}
          {isBottoming && (
            <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-[9px] font-mono font-black text-red-400 flex items-center gap-1">
              <AlertTriangle size={10} /> BOTTOMING
            </span>
          )}
          {!hasWheelspin && !hasLockup && !isOverheating && !isCold && !isBottoming && (
            <span className="text-[10px] font-mono font-bold text-emerald-400/80 px-1">
              ✓ Grip nominal & balanced
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
