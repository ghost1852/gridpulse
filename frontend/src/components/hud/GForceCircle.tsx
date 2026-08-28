import { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/Card';
import { motion } from 'framer-motion';
import { Compass } from 'lucide-react';

interface GForceCircleProps {
  accelX: number; // Lateral
  accelZ: number; // Longitudinal
}

interface Point {
  x: number;
  y: number;
}

export function GForceCircle({ accelX, accelZ }: GForceCircleProps) {
  const gX = accelX / 9.81;
  const gZ = accelZ / 9.81;
  const maxG = 2.0;
  const radius = 40; // compact radius that fits comfortably
  
  const dotX = Math.max(-radius, Math.min(radius, (gX / maxG) * radius));
  const dotY = Math.max(-radius, Math.min(radius, (gZ / maxG) * -radius));
  
  const totalG = Math.sqrt(gX * gX + gZ * gZ);
  const isHighG = totalG > 1.3;

  // Trail history
  const [trail, setTrail] = useState<Point[]>([]);
  const peakLatRef = useRef(0);
  const peakLonRef = useRef(0);

  if (Math.abs(gX) > peakLatRef.current) peakLatRef.current = Math.abs(gX);
  if (Math.abs(gZ) > peakLonRef.current) peakLonRef.current = Math.abs(gZ);

  useEffect(() => {
    setTrail(prev => {
      const next = [...prev, { x: dotX, y: dotY }];
      if (next.length > 6) next.shift();
      return next;
    });
  }, [dotX, dotY]);

  return (
    <Card className="p-2.5 sm:p-3 h-full flex flex-col justify-between items-center relative overflow-hidden bg-[#0d0d14] border-white/10">
      {/* Header */}
      <div className="w-full flex justify-between items-center border-b border-white/5 pb-1">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-gray-400">
          <Compass size={12} className="text-cyan-400" />
          <span>G-FORCE</span>
        </div>
        <span className="text-xs font-mono font-bold text-white">
          {totalG.toFixed(2)} <span className="text-gray-500 font-normal">G</span>
        </span>
      </div>

      {/* Friction Circle */}
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-white/20 bg-black/60 flex items-center justify-center my-1 shadow-inner shrink-0">
        {/* Crosshairs */}
        <div className="absolute w-full h-[1px] bg-white/15" />
        <div className="absolute h-full w-[1px] bg-white/15" />
        
        {/* 1.0G, 2.0G concentric rings */}
        <div className="absolute w-12 h-12 rounded-full border border-dashed border-white/15" />
        <span className="absolute top-0.5 text-[7px] font-mono text-gray-500">2G</span>
        <span className="absolute top-4 text-[7px] font-mono text-gray-600">1G</span>

        {/* Trail Ghost Dots */}
        {trail.map((pt, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400 pointer-events-none"
            style={{
              transform: `translate(${pt.x}px, ${pt.y}px)`,
              opacity: (i + 1) / 8,
            }}
          />
        ))}

        {/* Live G-Force Vector Point */}
        <motion.div 
          className="absolute w-3 h-3 rounded-full z-10"
          style={{
            backgroundColor: isHighG ? '#ef4444' : '#00ff88',
            boxShadow: isHighG ? '0 0 12px #ef4444' : '0 0 8px #00ff88'
          }}
          animate={{ x: dotX, y: dotY }}
          transition={{ type: 'spring', stiffness: 600, damping: 30 }}
        />
      </div>

      {/* Peak Hold Indicators Footer */}
      <div className="w-full grid grid-cols-2 gap-1 text-center text-[10px] sm:text-xs font-mono pt-1 border-t border-white/5 shrink-0">
        <div className="flex flex-col">
          <span className="text-[8px] text-gray-500 font-bold uppercase">Peak Lat</span>
          <span className="font-bold text-white">{peakLatRef.current.toFixed(2)} G</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] text-gray-500 font-bold uppercase">Peak Lon</span>
          <span className="font-bold text-white">{peakLonRef.current.toFixed(2)} G</span>
        </div>
      </div>
    </Card>
  );
}
