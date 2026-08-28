import { Card } from '../ui/Card';
import { motion } from 'framer-motion';

interface PedalMetersProps {
  throttle: number; // 0 to 255
  brake: number; // 0 to 255
}

export function PedalMeters({ throttle, brake }: PedalMetersProps) {
  const throttlePct = Math.round((Math.max(0, Math.min(255, throttle)) / 255) * 100);
  const brakePct = Math.round((Math.max(0, Math.min(255, brake)) / 255) * 100);

  return (
    <Card className="p-3 sm:p-4 flex items-center justify-around h-full min-h-[140px] bg-[#0e0e16] border-white/10 overflow-hidden">
      {/* Throttle Column */}
      <div className="flex flex-col items-center gap-1.5 h-full justify-between flex-1">
        <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
          THROTTLE
        </span>

        <div className="w-8 sm:w-10 flex-1 max-h-32 sm:max-h-40 bg-black/60 rounded-lg p-1 border border-white/10 flex flex-col justify-end overflow-hidden">
          <motion.div
            className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-md shadow-[0_0_12px_rgba(0,255,136,0.3)]"
            style={{ height: `${throttlePct}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>

        <span className="text-xs font-mono font-bold text-white">
          {throttlePct}%
        </span>
      </div>

      {/* Center Divider */}
      <div className="w-px h-24 bg-white/10" />

      {/* Brake Column */}
      <div className="flex flex-col items-center gap-1.5 h-full justify-between flex-1">
        <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-wider">
          BRAKE
        </span>

        <div className="w-8 sm:w-10 flex-1 max-h-32 sm:max-h-40 bg-black/60 rounded-lg p-1 border border-white/10 flex flex-col justify-end overflow-hidden">
          <motion.div
            className="w-full bg-gradient-to-t from-red-600 to-red-500 rounded-md shadow-[0_0_12px_rgba(255,34,68,0.3)]"
            style={{ height: `${brakePct}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>

        <span className="text-xs font-mono font-bold text-white">
          {brakePct}%
        </span>
      </div>
    </Card>
  );
}
