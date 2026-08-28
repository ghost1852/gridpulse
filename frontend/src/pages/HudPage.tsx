import { useTelemetry } from '../hooks/useTelemetry';
import { CarInfo } from '../components/hud/CarInfo';
import { Speedometer } from '../components/hud/Speedometer';
import { GForceCircle } from '../components/hud/GForceCircle';
import { PedalMeters } from '../components/hud/PedalMeters';
import { TireTemps } from '../components/hud/TireTemps';
import { LapTimer } from '../components/hud/LapTimer';
import { RaceAlertBanner } from '../components/hud/RaceAlertBanner';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';

export function HudPage() {
  const { telemetry, connected } = useTelemetry();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Fallback data
  const data = telemetry || {
    speed_mph: 0, 
    speed_kph: 0, 
    current_engine_rpm: 0, 
    engine_max_rpm: 8500, 
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
    race_position: 1, 
    drivetrain_type: 1,
    car_ordinal: 2544
  };

  return (
    <div className="w-full h-full">
      {/* ========================================================================= */}
      {/* 1. VERTICAL PORTRAIT MODE: Clean Linear Scroll with ZERO Overlaps         */}
      {/* ========================================================================= */}
      <div className="block landscape:hidden p-3 space-y-3 pb-36 overflow-y-auto">
        {/* Car Banner */}
        <CarInfo 
          carOrdinal={data.car_ordinal}
          carClass={data.car_class_name} 
          pi={data.car_performance_index} 
          drivetrainType={data.drivetrain_type}
          racePosition={data.race_position}
        />

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

        {/* Speedometer Cluster (Speed + 16-LED Tach + Gear + Stats) */}
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
          connected={connected} 
        />

        {/* Tire Thermals & Grip Card */}
        <TireTemps 
          fl={data.tire_temp_fl} fr={data.tire_temp_fr} 
          rl={data.tire_temp_rl} rr={data.tire_temp_rr} 
          slipFl={data.tire_slip_fl} slipFr={data.tire_slip_fr}
          slipRl={data.tire_slip_rl} slipRr={data.tire_slip_rr}
          suspFl={data.susp_fl} suspFr={data.susp_fr}
          suspRl={data.susp_rl} suspRr={data.susp_rr}
        />

        {/* G-Force Friction Circle Card */}
        <GForceCircle accelX={data.acceleration_x} accelZ={data.acceleration_z} />

        {/* Throttle & Brake Pedal Meters */}
        <div className="h-32">
          <PedalMeters throttle={data.accel} brake={data.brake} />
        </div>

        {/* Lap Times Card */}
        <LapTimer 
          currentLap={data.current_lap} 
          bestLap={data.best_lap} 
          lastLap={data.last_lap} 
        />

        {/* Extra Bottom Clearance Buffer for Mobile Bottom Nav */}
        <div className="h-10 pointer-events-none" />
      </div>

      {/* ========================================================================= */}
      {/* 2. HORIZONTAL LANDSCAPE COCKPIT MODE: Smooth Scrollable Edge-to-Edge      */}
      {/* ========================================================================= */}
      <div className="hidden landscape:flex flex-col justify-start p-2 gap-2 pb-16 overflow-y-auto">
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
            className="p-2 rounded-xl bg-black/40 border border-white/10 hover:border-emerald-400/50 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>

        {/* 3-Column Responsive Motorsport Grid */}
        <div className="grid grid-cols-12 gap-2 items-stretch min-h-0">
          {/* Left: Tires & Suspension (col 4) */}
          <div className="col-span-4 flex flex-col justify-between">
            <TireTemps 
              fl={data.tire_temp_fl} fr={data.tire_temp_fr} 
              rl={data.tire_temp_rl} rr={data.tire_temp_rr} 
              slipFl={data.tire_slip_fl} slipFr={data.tire_slip_fr}
              slipRl={data.tire_slip_rl} slipRr={data.tire_slip_rr}
              suspFl={data.susp_fl} suspFr={data.susp_fr}
              suspRl={data.susp_rl} suspRr={data.susp_rr}
            />
          </div>

          {/* Center: Speedometer + Shift Lights + Gear + Stats (col 5) */}
          <div className="col-span-5 flex flex-col justify-center">
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
              connected={connected} 
            />
          </div>

          {/* Right: G-Force Circle + Lap Times (col 3) */}
          <div className="col-span-3 flex flex-col justify-between gap-1.5">
            <div>
              <GForceCircle accelX={data.acceleration_x} accelZ={data.acceleration_z} />
            </div>
            <div className="shrink-0">
              <LapTimer 
                currentLap={data.current_lap} 
                bestLap={data.best_lap} 
                lastLap={data.last_lap} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
