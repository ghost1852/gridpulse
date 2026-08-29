import { useState, useRef } from 'react';
import { Card } from '../ui/Card';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useUnits } from '../../context/UnitContext';
import { Zap, Flame, Gauge } from 'lucide-react';

interface SpeedometerProps {
  speedMph: number;
  speedKph?: number;
  currentRpm?: number;
  maxRpm?: number;
  gear?: number;
  clutch?: number;
  powerHp?: number;
  torqueFtlb?: number;
  boostPsi?: number;
  fuelPct?: number;
  throttle?: number;
  brake?: number;
  connected?: boolean;
}

export function Speedometer({ 
  speedMph, 
  speedKph,
  currentRpm = 0,
  maxRpm = 8500,
  gear = 0,
  powerHp = 0,
  torqueFtlb = 0,
  boostPsi = 0,
  fuelPct = 100,
  throttle = 0,
  brake = 0,
  connected = true 
}: SpeedometerProps) {
  const [unit, setUnit] = useState<'MPH' | 'KPH'>('MPH');
  const { convertPressure, toggleUnit } = useUnits();
  const smoothedHpRef = useRef<number>(0);
  const smoothedTorqueRef = useRef<number>(0);

  // Smooth out raw power/torque jitter
  smoothedHpRef.current = Math.round(smoothedHpRef.current * 0.65 + (powerHp || 0) * 0.35);
  smoothedTorqueRef.current = Math.round(smoothedTorqueRef.current * 0.65 + (torqueFtlb || 0) * 0.35);

  const displayHp = smoothedHpRef.current;
  const displayTorque = smoothedTorqueRef.current;
  
  const currentSpeed = unit === 'MPH' 
    ? Math.max(0, Math.floor(speedMph)) 
    : Math.max(0, Math.floor(speedKph ?? speedMph * 1.60934));

  const isHighSpeed = currentSpeed > (unit === 'MPH' ? 120 : 190);
  const isSuperSpeed = currentSpeed > (unit === 'MPH' ? 180 : 280);

  // RPM percentage & shift point calculations
  const safeMax = maxRpm > 0 ? maxRpm : 8500;
  const rpmPct = Math.min(100, Math.max(0, (currentRpm / safeMax) * 100));
  const isShiftFlash = rpmPct > 93;
  const numLeds = 16;
  const activeLeds = Math.round((rpmPct / 100) * numLeds);

  const gearText = gear === 0 ? 'R' : gear > 0 ? String(gear) : 'N';

  // Pedal percentages
  const throttlePct = Math.round((Math.max(0, Math.min(255, throttle)) / 255) * 100);
  const brakePct = Math.round((Math.max(0, Math.min(255, brake)) / 255) * 100);

  const boostConverted = convertPressure(boostPsi);

  return (
    <Card className={cn(
      "flex flex-col justify-between p-2.5 sm:p-3 relative overflow-hidden transition-all duration-300 bg-[#0d0d14]",
      isSuperSpeed ? "border-pink-500/70 shadow-[0_0_25px_rgba(236,72,153,0.2)]" : isHighSpeed ? "border-emerald-500/50 shadow-[0_0_20px_rgba(0,255,136,0.12)]" : "border-white/10"
    )}>
      {/* Background Neon Speed Glow */}
      <div 
        className={cn(
          "absolute inset-0 transition-opacity duration-300 pointer-events-none",
          isSuperSpeed ? "bg-gradient-to-t from-pink-500/15 to-transparent opacity-80" : isHighSpeed ? "bg-gradient-to-t from-[var(--color-accent-primary)]/10 to-transparent opacity-60" : "opacity-0"
        )} 
      />

      {/* Top Bar: Digital Live RPM + 16-LED Shift Lights + Unit Switcher */}
      <div className="w-full flex items-center justify-between gap-1.5 sm:gap-2 z-10 shrink-0 mb-1">
        {/* Digital Live RPM readout */}
        <div className="flex items-baseline gap-1 shrink-0 bg-black/50 px-2 py-0.5 rounded border border-white/10">
          <span className="text-[8px] font-mono font-bold text-gray-400">RPM</span>
          <span className={cn(
            "text-xs sm:text-sm font-mono font-black tracking-tight",
            isShiftFlash ? "text-red-400 animate-pulse" : "text-white"
          )}>
            {Math.round(currentRpm).toLocaleString()}
          </span>
          <span className="text-[8px] font-mono text-gray-500 hidden sm:inline">
            / {Math.round(safeMax).toLocaleString()}
          </span>
        </div>

        {/* 16-LED Shift Light Strip */}
        <div className="flex-1 max-w-[220px] sm:max-w-[260px] flex items-center justify-center gap-0.5 sm:gap-1 bg-black/60 p-1 rounded-full border border-white/10">
          {Array.from({ length: numLeds }).map((_, i) => {
            const isActive = i < activeLeds;
            const isRed = i >= 12;
            const isAmber = i >= 8 && i < 12;
            
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 h-1.5 rounded-full transition-all duration-75",
                  isActive
                    ? isRed
                      ? "bg-red-500 shadow-[0_0_8px_#ef4444]"
                      : isAmber
                        ? "bg-amber-400 shadow-[0_0_6px_#f59e0b]"
                        : "bg-emerald-400 shadow-[0_0_6px_#10b981]"
                    : "bg-white/10",
                  isShiftFlash && isRed && "animate-ping"
                )}
              />
            );
          })}
        </div>

        {/* Unit Toggle */}
        <button
          onClick={() => setUnit(unit === 'MPH' ? 'KPH' : 'MPH')}
          className="px-2 py-0.5 rounded bg-black/50 border border-white/10 hover:border-emerald-400/50 text-[10px] font-mono font-bold text-gray-300 hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
        >
          {unit} ⇄
        </button>
      </div>

      {/* Main Center Cockpit Deck: Throttle Bar | Speed & Gear | Brake Bar */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 my-auto py-1 z-10">
        
        {/* Left Column: High-Visibility Glowing Throttle Bar */}
        <div className="flex flex-col items-center gap-1 w-10 sm:w-12 shrink-0">
          <span className="text-[8px] sm:text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-tight">
            THR
          </span>
          <div className="w-5 sm:w-6 h-16 sm:h-20 bg-black/70 rounded-md p-0.5 border border-white/10 flex flex-col justify-end overflow-hidden">
            <motion.div
              className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-sm shadow-[0_0_10px_rgba(0,255,136,0.5)]"
              style={{ height: `${throttlePct}%` }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          </div>
          <span className="text-[9px] sm:text-[10px] font-mono font-black text-emerald-400">
            {throttlePct}%
          </span>
        </div>

        {/* Center: Big Bold Speed Number + Gear Box */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 flex-1">
          {/* Speed Number */}
          <div className="flex flex-col items-center">
            <motion.div 
              key={`${unit}-${currentSpeed}`}
              initial={{ opacity: 0.95, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-6xl sm:text-7xl md:text-8xl landscape:text-5xl lg:landscape:text-6xl font-mono font-black leading-none tracking-tighter"
              style={{ 
                color: connected ? 'white' : 'var(--color-text-muted)',
                textShadow: isSuperSpeed 
                  ? '0 0 35px rgba(236,72,153,0.5)' 
                  : isHighSpeed 
                    ? '0 0 25px rgba(0,255,136,0.4)' 
                    : 'none'
              }}
            >
              {currentSpeed.toString().padStart(3, '0')}
            </motion.div>
            
            <span className="text-[10px] sm:text-xs font-mono font-black tracking-[0.25em] text-[var(--color-accent-primary)] uppercase">
              {unit}
            </span>
          </div>

          {/* Motorsport Gear Box */}
          <div className="flex flex-col items-center">
            <div className={cn(
              "w-12 h-14 sm:w-16 sm:h-18 landscape:w-11 landscape:h-13 rounded-xl border-2 flex items-center justify-center bg-black/80 shadow-lg relative overflow-hidden transition-all",
              isShiftFlash ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]" : "border-white/20"
            )}>
              <span className={cn(
                "text-3xl sm:text-4xl landscape:text-2xl font-mono font-black",
                isShiftFlash ? "text-red-400 animate-pulse" : "text-emerald-400"
              )}>
                {gearText}
              </span>
            </div>
            <span className="text-[8px] font-mono text-gray-400 font-bold uppercase mt-0.5">GEAR</span>
          </div>
        </div>

        {/* Right Column: High-Visibility Glowing Brake Bar */}
        <div className="flex flex-col items-center gap-1 w-10 sm:w-12 shrink-0">
          <span className="text-[8px] sm:text-[9px] font-mono font-bold text-red-400 uppercase tracking-tight">
            BRK
          </span>
          <div className="w-5 sm:w-6 h-16 sm:h-20 bg-black/70 rounded-md p-0.5 border border-white/10 flex flex-col justify-end overflow-hidden">
            <motion.div
              className="w-full bg-gradient-to-t from-red-600 to-red-500 rounded-sm shadow-[0_0_10px_rgba(255,34,68,0.5)]"
              style={{ height: `${brakePct}%` }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          </div>
          <span className="text-[9px] sm:text-[10px] font-mono font-black text-red-400">
            {brakePct}%
          </span>
        </div>

      </div>

      {/* Bottom Row: Telemetry Quick Tiles (HP, Torque, Boost with Toggle, Fuel) */}
      <div className="w-full grid grid-cols-4 gap-1 sm:gap-2 pt-1.5 border-t border-white/10 z-10 shrink-0">
        {/* HP */}
        <div className="flex flex-col items-center bg-black/40 border border-white/5 rounded p-1">
          <div className="flex items-center gap-0.5 text-[8px] sm:text-[9px] text-gray-400 font-mono">
            <Zap size={9} className="text-amber-400" />
            <span>PWR</span>
          </div>
          <span className="text-[10px] sm:text-xs font-mono font-bold text-white">
            {displayHp > 0 ? `${displayHp}` : '---'}
          </span>
        </div>

        {/* Torque */}
        <div className="flex flex-col items-center bg-black/40 border border-white/5 rounded p-1">
          <div className="flex items-center gap-0.5 text-[8px] sm:text-[9px] text-gray-400 font-mono">
            <Flame size={9} className="text-orange-400" />
            <span>TRQ</span>
          </div>
          <span className="text-[10px] sm:text-xs font-mono font-bold text-white">
            {displayTorque > 0 ? `${displayTorque}` : '---'}
          </span>
        </div>

        {/* Boost (Clickable Unit Switcher) */}
        <div 
          onClick={() => toggleUnit('pressure')}
          className="flex flex-col items-center bg-black/40 border border-white/5 hover:border-cyan-400/40 rounded p-1 cursor-pointer transition-colors"
          title="Click to toggle PSI / BAR / KPA"
        >
          <div className="flex items-center gap-0.5 text-[8px] sm:text-[9px] text-cyan-400 font-mono">
            <Gauge size={9} />
            <span>{boostConverted.label}</span>
          </div>
          <span className="text-[10px] sm:text-xs font-mono font-bold text-cyan-300">
            {boostConverted.value > 0 ? `+${boostConverted.value}` : `${boostConverted.value}`}
          </span>
        </div>

        {/* Fuel */}
        <div className="flex flex-col items-center bg-black/40 border border-white/5 rounded p-1">
          <div className="flex items-center gap-0.5 text-[8px] sm:text-[9px] text-gray-400 font-mono">
            <span className="text-[8px] text-emerald-400 font-bold">FUEL</span>
          </div>
          <span className="text-[10px] sm:text-xs font-mono font-bold text-white">
            {Math.round(fuelPct)}%
          </span>
        </div>
      </div>
    </Card>
  );
}
