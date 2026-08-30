import { useState } from 'react';
import { Card } from '../ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Activity, X, Sparkles } from 'lucide-react';
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
}

export function TireTemps({ 
  fl, fr, rl, rr,
  slipFl = 0, slipFr = 0, slipRl = 0, slipRr = 0,
  slipAngleFl = 0, slipAngleFr = 0, slipAngleRl = 0, slipAngleRr = 0,
  suspFl = 0.5, suspFr = 0.5, suspRl = 0.5, suspRr = 0.5
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
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-1.5 h-10 sm:h-12 bg-black/60 border border-white/10 rounded-full relative overflow-hidden flex flex-col justify-end">
            <motion.div 
              className={cn(
                "w-full rounded-full transition-all duration-75",
                (1 - susp) > 0.85 ? "bg-red-500" : (1 - susp) > 0.6 ? "bg-amber-400" : "bg-emerald-400"
              )}
              style={{ height: `${Math.min(100, Math.max(0, (1 - susp) * 100))}%` }}
            />
          </div>
          <span className="text-[7px] font-mono text-gray-500 font-bold">SUS</span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center justify-between w-full px-0.5">
            <span className="text-[9px] text-gray-400 font-bold font-mono uppercase group-hover:text-cyan-300 transition-colors">
              {corner}
            </span>
          </div>

          <motion.div 
            className="w-12 sm:w-14 h-14 sm:h-16 rounded-xl border-2 relative overflow-hidden flex flex-col items-center justify-center bg-black/80 shadow-md transition-all group-hover:border-cyan-400"
            style={{ borderColor: color }}
            animate={isDanger(temp) ? { 
              boxShadow: [`0 0 0px ${color}`, `0 0 12px ${color}`, `0 0 0px ${color}`]
            } : {}}
            transition={isDanger(temp) ? { repeat: Infinity, duration: 0.4 } : {}}
          >
            <div className="absolute inset-0 opacity-25" style={{ backgroundColor: color }} />
            <span className="font-mono text-sm sm:text-base font-black text-white z-10 tracking-tight">
              {converted.value}°
            </span>
            <span 
              className="text-[6.5px] font-mono font-bold px-1 py-0.2 rounded z-10 uppercase mt-0.5"
              style={{ backgroundColor: `${color}25`, color: color }}
            >
              {temp < 150 ? 'COLD' : temp < 205 ? 'OPTIMAL' : temp < 240 ? 'WARM' : 'HOT'}
            </span>
            <div className="absolute bottom-0.5 inset-x-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all duration-100", slip > 1.2 ? "bg-red-500" : slip > 0.6 ? "bg-amber-400" : "bg-emerald-400")}
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
      <div className="flex justify-between items-center border-b border-white/5 pb-1 mb-2 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-gray-400">
          <Activity size={12} className="text-emerald-400" />
          <span>TIRE THERMALS</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-gray-500">
          <span className="text-cyan-400">TAP TIRE FOR TELEMETRY</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-around py-2">
        <div className="flex items-center justify-between gap-4">
          <TirePod corner="FL" temp={fl} slip={slipFl} susp={suspFl} isLeft={true} />
          <TirePod corner="FR" temp={fr} slip={slipFr} susp={suspFr} isLeft={false} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <TirePod corner="RL" temp={rl} slip={slipRl} susp={suspRl} isLeft={true} />
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
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  setInspectedCorner(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setInspectedCorner(null);
                }}
                className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/40 text-white cursor-pointer touch-manipulation z-40 select-none active:scale-95"
                title="Close Tire Telemetry"
              >
                <X size={16} className="text-white" />
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
