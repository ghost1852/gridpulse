import { useState, useEffect } from 'react';
import { useTelemetry } from '../hooks/useTelemetry';
import { Speedometer } from '../components/hud/Speedometer';
import { TireTemps } from '../components/hud/TireTemps';
import { LapTimer } from '../components/hud/LapTimer';
import { GForceCircle } from '../components/hud/GForceCircle';
import { CarInfo } from '../components/hud/CarInfo';
import { RaceAlertBanner } from '../components/hud/RaceAlertBanner';
import { TractionDynamics } from '../components/hud/TractionDynamics';
import { Maximize2, Minimize2, CheckCircle2, Trash2, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export function HudPage() {
  const { telemetry, connected, lapState } = useTelemetry();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Fallback demo/empty telemetry object
  const data = telemetry || {
    speed_mph: 0,
    speed_kph: 0,
    current_engine_rpm: 0,
    engine_max_rpm: 8000,
    gear: 0,
    accel: 0,
    brake: 0,
    clutch: 0,
    handbrake: 0,
    steer: 0,
    tire_temp_fl: 100, 
    tire_temp_fr: 100, 
    tire_temp_rl: 100, 
    tire_temp_rr: 100,
    tire_slip_fl: 0,
    tire_slip_fr: 0,
    tire_slip_rl: 0,
    tire_slip_rr: 0,
    slip_angle_fl: 0,
    slip_angle_fr: 0,
    slip_angle_rl: 0,
    slip_angle_rr: 0,
    slip_ratio_fl: 0,
    slip_ratio_fr: 0,
    slip_ratio_rl: 0,
    slip_ratio_rr: 0,
    susp_fl: 0.5,
    susp_fr: 0.5,
    susp_rl: 0.5,
    susp_rr: 0.5,
    power_hp: 0,
    torque_ftlb: 0,
    boost_psi: 0,
    fuel_pct: 100,
    acceleration_x: 0, 
    acceleration_z: 0,
    car_class_name: 'S1', 
    car_performance_index: 895,
    best_lap: 0, 
    current_lap: 0, 
    last_lap: 0,
    current_race_time: 0,
    lap_number: 0,
    race_position: 1, 
    drivetrain_type: 1,
    car_ordinal: 2544,
    position_x: 0,
    position_y: 0,
    position_z: 0
  };

  // Loss-of-control dynamic edge warning (severe spin / snap oversteer / full lockup at speed)
  const avgRearSlip = ((data.tire_slip_rl || 0) + (data.tire_slip_rr || 0)) / 2;
  const avgFrontSlip = ((data.tire_slip_fl || 0) + (data.tire_slip_fr || 0)) / 2;
  const isSevereOversteer = (avgRearSlip - avgFrontSlip > 0.65) && data.speed_mph > 25;
  const isSevereLockup = ((data.slip_ratio_fl || 0) < -0.85 || (data.slip_ratio_fr || 0) < -0.85) && data.brake > 150 && data.speed_mph > 30;
  const isLossOfControl = isSevereOversteer || isSevereLockup;

  return (
    <div className="w-full h-full relative">
      {/* Loss of Control Edge Warning Vignette */}
      {isLossOfControl && (
        <div className="fixed inset-0 pointer-events-none z-50 border-4 border-red-500/50 shadow-[inset_0_0_35px_rgba(255,34,68,0.4)] animate-pulse" />
      )}

      {/* ========================================================================= */}
      {/* 1. VERTICAL PORTRAIT MODE: Clean Single-Screen Cockpit Layout             */}
      {/* ========================================================================= */}
      <div className="block landscape:hidden p-2 space-y-2 pb-20 overflow-y-auto max-w-lg mx-auto min-w-0 w-full">
        {/* Car & Connection Status Bar */}
        <CarInfo 
          carOrdinal={data.car_ordinal}
          carClass={data.car_class_name} 
          pi={data.car_performance_index} 
          drivetrainType={data.drivetrain_type}
          racePosition={data.race_position}
        />

        {/* Action / Gate Feedback Toast */}
        <AnimatePresence>
          {lapState.lastFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border shadow-lg",
                lapState.lastFeedback.type === 'success' && "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_15px_rgba(0,255,136,0.15)]",
                lapState.lastFeedback.type === 'cleared' && "bg-red-500/20 text-red-300 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.15)]",
                lapState.lastFeedback.type === 'info' && "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              )}
            >
              {lapState.lastFeedback.type === 'success' && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
              {lapState.lastFeedback.type === 'cleared' && <Trash2 size={14} className="text-red-400 shrink-0" />}
              {lapState.lastFeedback.type === 'info' && <MapPin size={14} className="text-cyan-400 shrink-0" />}
              <span className="flex-1 text-[11px]">{lapState.lastFeedback.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Race Alerts Banner */}
        <RaceAlertBanner
          tireTempFl={data.tire_temp_fl}
          tireTempFr={data.tire_temp_fr}
          tireTempRl={data.tire_temp_rl}
          tireTempRr={data.tire_temp_rr}
          suspFl={data.susp_fl}
          suspFr={data.susp_fr}
          suspRl={data.susp_rl}
          suspRr={data.susp_rr}
          slipFl={data.tire_slip_fl}
          slipFr={data.tire_slip_fr}
          slipRl={data.tire_slip_rl}
          slipRr={data.tire_slip_rr}
          currentRpm={data.current_engine_rpm}
          maxRpm={data.engine_max_rpm}
          brake={data.brake}
        />

        {/* Speedometer Cluster (Speed + Throttle/Brake Pedal Meters + 16-LED Tach + Gear) */}
        <Speedometer 
          speedMph={data.speed_mph} 
          speedKph={data.speed_kph}
          currentRpm={data.current_engine_rpm}
          maxRpm={data.engine_max_rpm}
          gear={data.gear}
          powerHp={data.power_hp}
          torqueFtlb={data.torque_ftlb}
          boostPsi={data.boost_psi}
          fuelPct={data.fuel_pct}
          throttle={data.accel}
          brake={data.brake}
          connected={connected} 
        />

        {/* 2-Column Core Telemetry Matrix: All 4 Sub-Gauges Visible on Single Screen */}
        <div className="grid grid-cols-2 gap-2 min-w-0 w-full">
          {/* Top-Left: Pure 4-Corner Tire Thermals & Suspension */}
          <div className="min-w-0 h-full min-h-[175px]">
            <TireTemps 
              fl={data.tire_temp_fl} fr={data.tire_temp_fr} 
              rl={data.tire_temp_rl} rr={data.tire_temp_rr} 
              slipFl={data.tire_slip_fl} slipFr={data.tire_slip_fr}
              slipRl={data.tire_slip_rl} slipRr={data.tire_slip_rr}
              slipAngleFl={data.slip_angle_fl} slipAngleFr={data.slip_angle_fr}
              slipAngleRl={data.slip_angle_rl} slipAngleRr={data.slip_angle_rr}
              suspFl={data.susp_fl} suspFr={data.susp_fr}
              suspRl={data.susp_rl} suspRr={data.susp_rr}
            />
          </div>

          {/* Top-Right: Dedicated Lap Timer & Time Attack Controls (Reset Lap, Move S/F, Clear) */}
          <div className="min-w-0 h-full min-h-[175px]">
            <LapTimer 
              currentLap={data.current_lap > 0 ? data.current_lap : lapState.liveLapTime}
              bestLap={data.best_lap > 0 ? data.best_lap : lapState.bestLapTime}
              lastLap={data.last_lap > 0 ? data.last_lap : lapState.lastLapTime}
              lapNumber={data.lap_number > 0 ? data.lap_number : lapState.lapNumber}
              liveDeltaVsPb={lapState.liveDeltaVsPb}
              isArmed={lapState.isArmed}
              isDirty={lapState.isDirty}
              hasCustomGate={lapState.hasCustomGate}
              onSetCustomGate={lapState.setCustomGateAtCurrentPosition}
              onResetLap={lapState.resetLapTiming}
              onClearGate={lapState.clearGate}
            />
          </div>

          {/* Bottom-Left: Chassis Balance & Dynamic Traction */}
          <div className="min-w-0 h-full min-h-[175px]">
            <TractionDynamics
              slipAngleFl={data.slip_angle_fl}
              slipAngleFr={data.slip_angle_fr}
              slipAngleRl={data.slip_angle_rl}
              slipAngleRr={data.slip_angle_rr}
              slipRatioFl={data.slip_ratio_fl}
              slipRatioFr={data.slip_ratio_fr}
              slipRatioRl={data.slip_ratio_rl}
              slipRatioRr={data.slip_ratio_rr}
              tireTempFl={data.tire_temp_fl}
              tireTempFr={data.tire_temp_fr}
              tireTempRl={data.tire_temp_rl}
              tireTempRr={data.tire_temp_rr}
              accelX={data.acceleration_x}
              accelZ={data.acceleration_z}
              throttle={data.accel}
              brake={data.brake}
              suspFl={data.susp_fl}
              suspFr={data.susp_fr}
              suspRl={data.susp_rl}
              suspRr={data.susp_rr}
            />
          </div>

          {/* Bottom-Right: G-Force Friction Circle (Moved from top-right) */}
          <div className="min-w-0 h-full min-h-[175px]">
            <GForceCircle 
              accelX={data.acceleration_x} 
              accelZ={data.acceleration_z} 
              slipAngleDelta={((Math.abs(data.slip_angle_rl || 0) + Math.abs(data.slip_angle_rr || 0)) / 2) - ((Math.abs(data.slip_angle_fl || 0) + Math.abs(data.slip_angle_fr || 0)) / 2)}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. HORIZONTAL LANDSCAPE COCKPIT MODE: Balanced Full-Width Cockpit Grid   */}
      {/* ========================================================================= */}
      <div className="hidden landscape:flex flex-col justify-between p-2 sm:p-3 gap-2 h-full overflow-y-auto max-h-screen">
        {/* Top Slim Header */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex-1">
            <CarInfo 
              carOrdinal={data.car_ordinal}
              carClass={data.car_class_name} 
              pi={data.car_performance_index} 
              drivetrainType={data.drivetrain_type}
              racePosition={data.race_position}
            />
          </div>

          <button
            onClick={toggleFullscreen}
            title="Toggle Cockpit Fullscreen"
            className="p-1.5 rounded-xl bg-black/40 border border-white/10 hover:border-emerald-400/50 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>

        {/* Top Row: 3-Column Gauges (Tires | Speed & Pedals | Lap Timing & G-Force Stack) */}
        <div className="grid grid-cols-12 gap-2 items-stretch flex-1 min-h-0">
          {/* Left: Pure 4-Corner Tire Thermals (col 4) */}
          <div className="col-span-4 flex flex-col justify-center">
            <TireTemps 
              fl={data.tire_temp_fl} fr={data.tire_temp_fr} 
              rl={data.tire_temp_rl} rr={data.tire_temp_rr} 
              slipFl={data.tire_slip_fl} slipFr={data.tire_slip_fr}
              slipRl={data.tire_slip_rl} slipRr={data.tire_slip_rr}
              slipAngleFl={data.slip_angle_fl} slipAngleFr={data.slip_angle_fr}
              slipAngleRl={data.slip_angle_rl} slipAngleRr={data.slip_angle_rr}
              suspFl={data.susp_fl} suspFr={data.susp_fr}
              suspRl={data.susp_rl} suspRr={data.susp_rr}
            />
          </div>

          {/* Center: Speedometer + Pedals + Shift Lights + Gear + Stats (col 4) */}
          <div className="col-span-4 flex flex-col justify-center">
            <Speedometer 
              speedMph={data.speed_mph} 
              speedKph={data.speed_kph}
              currentRpm={data.current_engine_rpm}
              maxRpm={data.engine_max_rpm}
              gear={data.gear}
              powerHp={data.power_hp}
              torqueFtlb={data.torque_ftlb}
              boostPsi={data.boost_psi}
              fuelPct={data.fuel_pct}
              throttle={data.accel}
              brake={data.brake}
              connected={connected} 
            />
          </div>

          {/* Right: Lap Timer & G-Force Stack (col 4) */}
          <div className="col-span-4 flex flex-col justify-between gap-2">
            <div className="flex-1 min-h-0">
              <LapTimer 
                currentLap={data.current_lap > 0 ? data.current_lap : lapState.liveLapTime}
                bestLap={data.best_lap > 0 ? data.best_lap : lapState.bestLapTime}
                lastLap={data.last_lap > 0 ? data.last_lap : lapState.lastLapTime}
                lapNumber={data.lap_number > 0 ? data.lap_number : lapState.lapNumber}
                liveDeltaVsPb={lapState.liveDeltaVsPb}
                isArmed={lapState.isArmed}
                isDirty={lapState.isDirty}
                hasCustomGate={lapState.hasCustomGate}
                onSetCustomGate={lapState.setCustomGateAtCurrentPosition}
                onResetLap={lapState.resetLapTiming}
                onClearGate={lapState.clearGate}
              />
            </div>
            <div className="flex-1 min-h-0">
              <GForceCircle 
                accelX={data.acceleration_x} 
                accelZ={data.acceleration_z} 
                slipAngleDelta={((Math.abs(data.slip_angle_rl || 0) + Math.abs(data.slip_angle_rr || 0)) / 2) - ((Math.abs(data.slip_angle_fl || 0) + Math.abs(data.slip_angle_fr || 0)) / 2)}
              />
            </div>
          </div>
        </div>

        {/* Bottom Row: Full-Width Chassis Balance & Dynamic Traction Ribbon */}
        <div className="w-full shrink-0">
          <TractionDynamics
            slipAngleFl={data.slip_angle_fl}
            slipAngleFr={data.slip_angle_fr}
            slipAngleRl={data.slip_angle_rl}
            slipAngleRr={data.slip_angle_rr}
            slipRatioFl={data.slip_ratio_fl}
            slipRatioFr={data.slip_ratio_fr}
            slipRatioRl={data.slip_ratio_rl}
            slipRatioRr={data.slip_ratio_rr}
            tireTempFl={data.tire_temp_fl}
            tireTempFr={data.tire_temp_fr}
            tireTempRl={data.tire_temp_rl}
            tireTempRr={data.tire_temp_rr}
            accelX={data.acceleration_x}
            accelZ={data.acceleration_z}
            throttle={data.accel}
            brake={data.brake}
            suspFl={data.susp_fl}
            suspFr={data.susp_fr}
            suspRl={data.susp_rl}
            suspRr={data.susp_rr}
          />
        </div>
      </div>
    </div>
  );
}
