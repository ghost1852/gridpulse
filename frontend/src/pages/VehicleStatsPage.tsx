import { useState, useRef, useEffect } from 'react';
import { useTelemetry } from '../hooks/useTelemetry';
import { useUnits } from '../context/UnitContext';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { TuningRecommendations } from '../components/hud/TuningRecommendations';
import { getCarInfo, saveCustomCar } from '../lib/cars';
import { 
  Zap, 
  Flame, 
  Gauge, 
  Fuel, 
  Compass, 
  ShieldAlert, 
  Waves,
  ArrowUpRight,
  Car,
  Play,
  Square,
  History,
  Download,
  FileSpreadsheet,
  Copy,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { motion } from 'framer-motion';

interface TelemetrySample {
  timeSec: number;
  speedMph: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  latG: number;
  lonG: number;
  tireTempFl: number;
  tireTempFr: number;
  tireTempRl: number;
  tireTempRr: number;
  suspFl: number;
  suspFr: number;
  suspRl: number;
  suspRr: number;
}

interface StintRecord {
  id: string;
  startTime: string;
  durationSec: number;
  carName: string;
  carClass: string;
  carPi: number;
  topSpeedMph: number;
  peakLatG: number;
  peakDecG: number;
  distanceMiles: number;
  bottomOuts: number;
  samples?: TelemetrySample[];
}

export function VehicleStatsPage() {
  const { telemetry } = useTelemetry();
  const { convertTemp } = useUnits();

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
    acceleration_y: 0,
    acceleration_z: 0,
    velocity_x: 0,
    velocity_y: 0,
    velocity_z: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    drift_angle: 0,
    yaw_rate_degs: 0,
    surface_rumble_fl: 0,
    surface_rumble_fr: 0,
    surface_rumble_rl: 0,
    surface_rumble_rr: 0,
    puddle_depth_fl: 0,
    puddle_depth_fr: 0,
    puddle_depth_rl: 0,
    puddle_depth_rr: 0,
    rumble_strip_fl: 0,
    rumble_strip_fr: 0,
    rumble_strip_rl: 0,
    rumble_strip_rr: 0,
    car_ordinal: 2544,
    car_class_name: 'S1',
    car_performance_index: 895,
    best_lap: 0,
    current_lap: 0,
    last_lap: 0,
    race_position: 1,
    drivetrain_type: 1,
    drivetrain_name: 'RWD',
  };

  // Peak tracking
  const peakHpRef = useRef(0);
  const peakTorqueRef = useRef(0);
  const peakBoostRef = useRef(0);

  if (data.power_hp > peakHpRef.current) peakHpRef.current = data.power_hp;
  if (data.torque_ftlb > peakTorqueRef.current) peakTorqueRef.current = data.torque_ftlb;
  if (data.boost_psi > peakBoostRef.current) peakBoostRef.current = data.boost_psi;

  // Stint Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [stintTimeSec, setStintTimeSec] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [stintHistory, setStintHistory] = useState<StintRecord[]>(() => {
    try {
      const saved = localStorage.getItem('forza_stints_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const stintStatsRef = useRef({
    startTime: '',
    startSec: 0,
    topSpeed: 0,
    peakLatG: 0,
    peakDecG: 0,
    startDist: 0,
    bottomOuts: 0,
    samples: [] as TelemetrySample[],
  });

  // Stint timer interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRecording) {
      interval = setInterval(() => {
        setStintTimeSec(s => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Sample telemetry at 2Hz during recording stint
  useEffect(() => {
    if (isRecording) {
      const speed = Math.round(data.speed_mph);
      if (speed > stintStatsRef.current.topSpeed) {
        stintStatsRef.current.topSpeed = speed;
      }
      const latG = Number((Math.abs(data.acceleration_x) / 9.81).toFixed(2));
      if (latG > stintStatsRef.current.peakLatG) {
        stintStatsRef.current.peakLatG = latG;
      }
      const decG = Number((Math.abs(Math.min(0, data.acceleration_z)) / 9.81).toFixed(2));
      if (decG > stintStatsRef.current.peakDecG) {
        stintStatsRef.current.peakDecG = decG;
      }
      if (data.susp_fl < 0.05 || data.susp_fr < 0.05 || data.susp_rl < 0.05 || data.susp_rr < 0.05) {
        stintStatsRef.current.bottomOuts += 1;
      }

      // Record snapshot
      stintStatsRef.current.samples.push({
        timeSec: stintTimeSec,
        speedMph: speed,
        rpm: Math.round(data.current_engine_rpm),
        gear: data.gear,
        throttle: Math.round((data.accel / 255) * 100),
        brake: Math.round((data.brake / 255) * 100),
        latG,
        lonG: Number((data.acceleration_z / 9.81).toFixed(2)),
        tireTempFl: Math.round(data.tire_temp_fl),
        tireTempFr: Math.round(data.tire_temp_fr),
        tireTempRl: Math.round(data.tire_temp_rl),
        tireTempRr: Math.round(data.tire_temp_rr),
        suspFl: Number(data.susp_fl.toFixed(3)),
        suspFr: Number(data.susp_fr.toFixed(3)),
        suspRl: Number(data.susp_rl.toFixed(3)),
        suspRr: Number(data.susp_rr.toFixed(3)),
      });
    }
  }, [isRecording, stintTimeSec, data]);

  const startStint = () => {
    stintStatsRef.current = {
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      startSec: Date.now(),
      topSpeed: Math.round(data.speed_mph),
      peakLatG: Math.abs(data.acceleration_x) / 9.81,
      peakDecG: 0,
      startDist: 0,
      bottomOuts: 0,
      samples: [],
    };
    setStintTimeSec(0);
    setIsRecording(true);
  };

  const stopStint = () => {
    const activeCar = getCarInfo(data.car_ordinal, data.car_class_name, data.car_performance_index);
    const newRecord: StintRecord = {
      id: String(Date.now()),
      startTime: stintStatsRef.current.startTime,
      durationSec: stintTimeSec,
      carName: `${activeCar.manufacturer} ${activeCar.name}`,
      carClass: data.car_class_name,
      carPi: data.car_performance_index,
      topSpeedMph: stintStatsRef.current.topSpeed,
      peakLatG: Number(stintStatsRef.current.peakLatG.toFixed(2)),
      peakDecG: Number(stintStatsRef.current.peakDecG.toFixed(2)),
      distanceMiles: Number(((stintStatsRef.current.topSpeed * (stintTimeSec / 3600)) * 0.75).toFixed(1)),
      bottomOuts: stintStatsRef.current.bottomOuts,
      samples: stintStatsRef.current.samples,
    };

    const updated = [newRecord, ...stintHistory].slice(0, 15);
    setStintHistory(updated);
    try {
      localStorage.setItem('forza_stints_history', JSON.stringify(updated));
    } catch {}
  };

  const deleteStint = (id: string) => {
    const updated = stintHistory.filter(s => s.id !== id);
    setStintHistory(updated);
    try {
      localStorage.setItem('forza_stints_history', JSON.stringify(updated));
    } catch {}
  };

  // Export JSON file
  const exportJson = (stint: StintRecord) => {
    const jsonStr = JSON.stringify(stint, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gridpulse_stint_${stint.carName.replace(/\s+/g, '_')}_${stint.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV file
  const exportCsv = (stint: StintRecord) => {
    const samples = stint.samples || [];
    let csv = 'TimeSec,SpeedMPH,RPM,Gear,ThrottlePct,BrakePct,LatG,LonG,TireFL,TireFR,TireRL,TireRR,SuspFL,SuspFR,SuspRL,SuspRR\n';
    samples.forEach(s => {
      csv += `${s.timeSec},${s.speedMph},${s.rpm},${s.gear},${s.throttle},${s.brake},${s.latG},${s.lonG},${s.tireTempFl},${s.tireTempFr},${s.tireTempRl},${s.tireTempRr},${s.suspFl},${s.suspFr},${s.suspRl},${s.suspRr}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gridpulse_telemetry_${stint.carName.replace(/\s+/g, '_')}_${stint.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy Markdown Race Engineer Debrief
  const copyReport = (stint: StintRecord) => {
    const report = `**GRIDPULSE TELEMETRY STINT DEBRIEF**
Vehicle: ${stint.carName} (${stint.carClass} ${stint.carPi})
Time: ${stint.startTime} | Duration: ${Math.floor(stint.durationSec / 60)}m ${stint.durationSec % 60}s
Top Speed: ${stint.topSpeedMph} MPH
Peak Lateral G: ${stint.peakLatG} G
Peak Braking Deceleration: ${stint.peakDecG} G
Estimated Distance: ${stint.distanceMiles} Miles
Suspension Bottom-Out Events: ${stint.bottomOuts}
Samples Captured: ${stint.samples?.length || 0}`;

    navigator.clipboard.writeText(report);
    setCopiedId(stint.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // True Pitch and Roll in degrees
  const pitchDeg = Number(((data.pitch || 0) * (180 / Math.PI)).toFixed(1));
  const rollDeg = Number(((data.roll || 0) * (180 / Math.PI)).toFixed(1));
  
  // True body drift angle
  const slipAngleDeg = data.drift_angle || 0;
  const isDrifting = slipAngleDeg > 12 && data.speed_mph > 15;

  // Surface rumble & puddles calculation
  const maxRumble = Math.max(data.surface_rumble_fl, data.surface_rumble_fr, data.surface_rumble_rl, data.surface_rumble_rr);
  const maxPuddle = Math.max(data.puddle_depth_fl, data.puddle_depth_fr, data.puddle_depth_rl, data.puddle_depth_rr);
  const isOnCurb = (data.rumble_strip_fl + data.rumble_strip_fr + data.rumble_strip_rl + data.rumble_strip_rr) > 0;

  // Dynamic Car Info lookup
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [customCarName, setCustomCarName] = useState('');
  const [customCarManufacturer, setCustomCarManufacturer] = useState('');

  const handleSaveCarName = () => {
    if (data.car_ordinal && customCarName.trim()) {
      saveCustomCar(data.car_ordinal, {
        name: customCarName.trim(),
        manufacturer: customCarManufacturer.trim() || 'Custom',
      });
      setShowRenameModal(false);
    }
  };

  const carInfo = getCarInfo(data.car_ordinal, data.car_class_name, data.car_performance_index);

  return (
    <div className="p-2 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-3 sm:space-y-4 pb-36 landscape:pb-16">
      {/* Top Banner: Car Header & Stint Recorder */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-[#111118] via-[#161622] to-[#111118] p-3 sm:p-4 rounded-2xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Car size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">
                {carInfo.manufacturer} • ORDINAL #{data.car_ordinal || '0'}
              </span>
              <Badge carClass={data.car_class_name} className="px-2 py-0.5 text-xs font-bold" />
              <span className="text-xs font-mono font-bold text-white">PI {data.car_performance_index}</span>
            </div>
            
            <div className="flex items-center gap-2 mt-0.5">
              <h1 className="text-base sm:text-lg font-bold text-white font-mono tracking-tight">
                {carInfo.name} • Telemetry Engineering Deck
              </h1>
              <button
                type="button"
                onPointerDown={() => {
                  setCustomCarName(carInfo.name);
                  setCustomCarManufacturer(carInfo.manufacturer);
                  setShowRenameModal(true);
                }}
                onClick={() => {
                  setCustomCarName(carInfo.name);
                  setCustomCarManufacturer(carInfo.manufacturer);
                  setShowRenameModal(true);
                }}
                className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 cursor-pointer touch-manipulation"
              >
                <span>Rename</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stint Recorder Controls */}
        <div className="flex items-center gap-2.5 bg-black/60 p-2 rounded-xl border border-white/10 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 px-1">
            <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-gray-600'}`} />
            <div className="flex flex-col">
              <span className="text-[8px] font-mono text-gray-400 uppercase font-bold">
                {isRecording ? 'RECORDING' : 'STINT TIMER'}
              </span>
              <span className="text-xs font-mono font-black text-white">
                {Math.floor(stintTimeSec / 60).toString().padStart(2, '0')}:{(stintTimeSec % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          {!isRecording ? (
            <button
              type="button"
              onPointerDown={startStint}
              onClick={startStint}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-[11px] font-mono font-bold uppercase transition-all shadow-md cursor-pointer touch-manipulation"
            >
              <Play size={12} fill="currentColor" />
              <span>Record</span>
            </button>
          ) : (
            <button
              type="button"
              onPointerDown={stopStint}
              onClick={stopStint}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 text-white text-[11px] font-mono font-bold uppercase transition-colors cursor-pointer touch-manipulation"
            >
              <Square size={12} fill="currentColor" />
              <span>Finish &amp; Save</span>
            </button>
          )}
        </div>
      </div>

      {/* Rename Car Modal */}
      {showRenameModal && (
        <Card className="p-4 space-y-3 bg-[#181826] border-cyan-500/40">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-mono font-bold text-white uppercase">
              Identify Vehicle Ordinal #{data.car_ordinal || '0'}
            </span>
            <button 
              type="button" 
              onPointerDown={() => setShowRenameModal(false)}
              onClick={() => setShowRenameModal(false)} 
              className="text-gray-400 hover:text-white touch-manipulation cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Manufacturer (e.g. Porsche, Dodge, Audi)</label>
              <input
                type="text"
                value={customCarManufacturer}
                onChange={(e) => setCustomCarManufacturer(e.target.value)}
                placeholder="Manufacturer name"
                className="w-full bg-black border border-white/20 rounded-lg p-2 text-white font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Model Name (e.g. 911 GT3 RS, Viper ACR)</label>
              <input
                type="text"
                value={customCarName}
                onChange={(e) => setCustomCarName(e.target.value)}
                placeholder="Vehicle Model"
                className="w-full bg-black border border-white/20 rounded-lg p-2 text-white font-bold"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onPointerDown={handleSaveCarName}
              onClick={handleSaveCarName}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black text-xs font-mono font-bold uppercase transition-colors cursor-pointer touch-manipulation"
            >
              Save Vehicle Profile
            </button>
          </div>
        </Card>
      )}

      {/* Grid 1: Powertrain Dynamics (HP, Torque, Boost, Fuel) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 landscape:grid-cols-4 gap-2 sm:gap-3">
        {/* HP */}
        <Card className="p-3 flex flex-col justify-between space-y-1.5 bg-[#0e0e16]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-gray-400">
              <Zap size={11} className="text-amber-400" />
              <span>POWER</span>
            </div>
            <span className="text-[8px] font-mono text-gray-500">PK {Math.round(peakHpRef.current)}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-mono font-black text-white">
              {Math.max(0, Math.round(data.power_hp))}
            </span>
            <span className="text-[10px] font-mono text-amber-400 font-bold">HP</span>
          </div>
          <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              className="h-full bg-amber-400 rounded-full"
              style={{ width: `${Math.min(100, (Math.max(0, data.power_hp) / Math.max(700, peakHpRef.current || 1)) * 100)}%` }}
            />
          </div>
        </Card>

        {/* Torque */}
        <Card className="p-3 flex flex-col justify-between space-y-1.5 bg-[#0e0e16]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-gray-400">
              <Flame size={11} className="text-orange-400" />
              <span>TORQUE</span>
            </div>
            <span className="text-[8px] font-mono text-gray-500">PK {Math.round(peakTorqueRef.current)}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-mono font-black text-white">
              {Math.max(0, Math.round(data.torque_ftlb))}
            </span>
            <span className="text-[10px] font-mono text-orange-400 font-bold">LB·FT</span>
          </div>
          <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              className="h-full bg-orange-400 rounded-full"
              style={{ width: `${Math.min(100, (Math.max(0, data.torque_ftlb) / Math.max(650, peakTorqueRef.current || 1)) * 100)}%` }}
            />
          </div>
        </Card>

        {/* Boost */}
        <Card className="p-3 flex flex-col justify-between space-y-1.5 bg-[#0e0e16]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-gray-400">
              <Gauge size={11} className="text-cyan-400" />
              <span>BOOST</span>
            </div>
            <span className="text-[8px] font-mono text-gray-500">PSI</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-mono font-black text-white">{data.boost_psi.toFixed(1)}</span>
            <span className="text-[10px] font-mono text-cyan-400 font-bold">PSI</span>
          </div>
          <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              className="h-full bg-cyan-400 rounded-full"
              style={{ width: `${Math.min(100, (Math.max(0, data.boost_psi) / 25) * 100)}%` }}
            />
          </div>
        </Card>

        {/* Fuel */}
        <Card className="p-3 flex flex-col justify-between space-y-1.5 bg-[#0e0e16]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-gray-400">
              <Fuel size={11} className="text-emerald-400" />
              <span>FUEL</span>
            </div>
            <span className="text-[8px] font-mono text-emerald-400 font-bold">100%</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-mono font-black text-white">{Math.round(data.fuel_pct)}</span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">%</span>
          </div>
          <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              className="h-full bg-emerald-400 rounded-full"
              style={{ width: `${Math.round(data.fuel_pct)}%` }}
            />
          </div>
        </Card>
      </div>

      {/* Grid 2: Chassis Horizon, Drift Dynamics & Surface Sensors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 landscape:grid-cols-3 gap-2 sm:gap-3">
        {/* Chassis Inclinometer */}
        <Card className="p-3 space-y-2 bg-[#0e0e16]">
          <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-gray-400">
              <Compass size={13} className="text-cyan-400" />
              <span>CHASSIS HORIZON</span>
            </div>
            <span className="text-[9px] font-mono text-gray-500">ATTITUDE</span>
          </div>

          <div className="flex items-center justify-center py-1">
            <div className="relative w-24 h-24 rounded-full border border-white/20 bg-black/60 overflow-hidden flex items-center justify-center shadow-inner">
              <motion.div 
                className="absolute inset-0 bg-gradient-to-b from-sky-950 via-black to-amber-950"
                style={{
                  transform: `rotate(${rollDeg}deg) translateY(${pitchDeg * 1.5}px)`
                }}
              />
              <div className="absolute w-full h-[1px] bg-emerald-400/80 z-10" />
              <div className="absolute w-2 h-2 rounded-full border border-white z-20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-center font-mono text-xs pt-1 border-t border-white/5">
            <div className="bg-black/40 rounded p-1 border border-white/5">
              <span className="text-[8px] text-gray-500 uppercase block font-bold">Pitch</span>
              <span className="text-xs font-bold text-white">{pitchDeg > 0 ? `+${pitchDeg.toFixed(1)}` : pitchDeg.toFixed(1)}°</span>
            </div>
            <div className="bg-black/40 rounded p-1 border border-white/5">
              <span className="text-[8px] text-gray-500 uppercase block font-bold">Roll</span>
              <span className="text-xs font-bold text-white">{rollDeg > 0 ? `+${rollDeg.toFixed(1)}` : rollDeg.toFixed(1)}°</span>
            </div>
          </div>
        </Card>

        {/* Drift Slip Angle & Yaw */}
        <Card className="p-3 space-y-2 bg-[#0e0e16]">
          <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-gray-400">
              <ArrowUpRight size={13} className="text-pink-400" />
              <span>DRIFT &amp; YAW</span>
            </div>
            {isDrifting && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-black bg-pink-500/20 text-pink-400 border border-pink-500/40 animate-pulse">
                DRIFT
              </span>
            )}
          </div>

          <div className="flex flex-col items-center justify-center py-1 space-y-0.5">
            <span className="text-3xl font-mono font-black text-white">
              {Math.abs(slipAngleDeg).toFixed(1)}°
            </span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-gray-400">
              {slipAngleDeg > 35 ? 'EXTREME SLIP' : slipAngleDeg > 15 ? 'DEEP SLIP' : 'GRIP LINE'}
            </span>

            <div className="w-full max-w-[160px] h-1.5 bg-black/60 rounded-full border border-white/10 overflow-hidden relative mt-1">
              <motion.div 
                className="h-full bg-gradient-to-r from-pink-500 to-amber-400 rounded-full"
                style={{ width: `${Math.min(100, (Math.abs(slipAngleDeg) / 60) * 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-center font-mono text-xs pt-1 border-t border-white/5">
            <div className="bg-black/40 rounded p-1 border border-white/5">
              <span className="text-[8px] text-gray-500 uppercase block font-bold">Yaw Rate</span>
              <span className="text-xs font-bold text-white">{Math.abs(data.yaw_rate_degs).toFixed(1)}°/s</span>
            </div>
            <div className="bg-black/40 rounded p-1 border border-white/5">
              <span className="text-[8px] text-gray-500 uppercase block font-bold">Lateral G</span>
              <span className="text-xs font-bold text-emerald-400">{(data.acceleration_x / 9.81).toFixed(2)} G</span>
            </div>
          </div>
        </Card>

        {/* Live Surface Sensors */}
        <Card className="p-3 space-y-2 bg-[#0e0e16]">
          <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-gray-400">
              <Waves size={13} className="text-sky-400" />
              <span>TRACK SURFACE</span>
            </div>
            <span className="text-[9px] font-mono text-gray-500">LIVE FEED</span>
          </div>

          <div className="space-y-2 py-0.5 font-mono text-xs">
            {/* Curb */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-gray-400 text-[10px]">
                <span>Curb Detection</span>
                <span className={isOnCurb ? 'text-amber-400 font-bold' : 'text-gray-500'}>
                  {isOnCurb ? 'ON CURB' : 'CLEAR'}
                </span>
              </div>
              <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
                <div className={`h-full rounded-full ${isOnCurb ? 'bg-amber-400 w-full' : 'bg-gray-800 w-0'}`} />
              </div>
            </div>

            {/* Rumble */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-gray-400 text-[10px]">
                <span>Surface Rumble</span>
                <span className="text-white font-bold">
                  {maxRumble > 0.05 ? `${(maxRumble * 100).toFixed(0)}%` : 'Smooth'}
                </span>
              </div>
              <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, maxRumble * 100)}%` }} />
              </div>
            </div>

            {/* Puddle */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-gray-400 text-[10px]">
                <span>Water / Puddle</span>
                <span className={maxPuddle > 0.05 ? 'text-sky-400 font-bold' : 'text-gray-500'}>
                  {maxPuddle > 0.05 ? `${(maxPuddle * 100).toFixed(0)}%` : 'Dry Track'}
                </span>
              </div>
              <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-sky-400 rounded-full" style={{ width: `${Math.min(100, maxPuddle * 100)}%` }} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Grid 3: 4-Corner Suspension & Tire Matrix */}
      <Card className="p-3.5 space-y-2 bg-[#0e0e16]">
        <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-gray-400">
            <ShieldAlert size={13} className="text-amber-400" />
            <span>4-CORNER SUSPENSION &amp; TIRE FRICTION MATRIX</span>
          </div>
          <span className="text-[9px] font-mono text-gray-500">CONTACT PATCH</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 landscape:grid-cols-4 gap-2 pt-0.5 font-mono text-xs">
          {/* FL */}
          <div className="bg-black/50 border border-white/10 rounded-lg p-2.5 space-y-1">
            <div className="flex justify-between items-center text-gray-400 font-bold text-[10px]">
              <span>FL</span>
              <span className="text-white">{convertTemp(data.tire_temp_fl).value}{convertTemp(data.tire_temp_fl).label}</span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-gray-500">
              <span>Susp</span>
              <span className="text-white font-bold">{Math.round((1 - data.susp_fl) * 100)}%</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.round((1 - data.susp_fl) * 100)}%` }} />
            </div>
          </div>

          {/* FR */}
          <div className="bg-black/50 border border-white/10 rounded-lg p-2.5 space-y-1">
            <div className="flex justify-between items-center text-gray-400 font-bold text-[10px]">
              <span>FR</span>
              <span className="text-white">{convertTemp(data.tire_temp_fr).value}{convertTemp(data.tire_temp_fr).label}</span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-gray-500">
              <span>Susp</span>
              <span className="text-white font-bold">{Math.round((1 - data.susp_fr) * 100)}%</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.round((1 - data.susp_fr) * 100)}%` }} />
            </div>
          </div>

          {/* RL */}
          <div className="bg-black/50 border border-white/10 rounded-lg p-2.5 space-y-1">
            <div className="flex justify-between items-center text-gray-400 font-bold text-[10px]">
              <span>RL</span>
              <span className="text-white">{convertTemp(data.tire_temp_rl).value}{convertTemp(data.tire_temp_rl).label}</span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-gray-500">
              <span>Susp</span>
              <span className="text-white font-bold">{Math.round((1 - data.susp_rl) * 100)}%</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.round((1 - data.susp_rl) * 100)}%` }} />
            </div>
          </div>

          {/* RR */}
          <div className="bg-black/50 border border-white/10 rounded-lg p-2.5 space-y-1">
            <div className="flex justify-between items-center text-gray-400 font-bold text-[10px]">
              <span>RR</span>
              <span className="text-white">{convertTemp(data.tire_temp_rr).value}{convertTemp(data.tire_temp_rr).label}</span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-gray-500">
              <span>Susp</span>
              <span className="text-white font-bold">{Math.round((1 - data.susp_rr) * 100)}%</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.round((1 - data.susp_rr) * 100)}%` }} />
            </div>
          </div>
        </div>
      </Card>

      {/* Grid 4: AI Race Engineer Persistent Telemetry Log */}
      <TuningRecommendations
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
        steer={data.steer}
        brake={data.brake}
        speedMph={data.speed_mph}
      />

      {/* Grid 5: Saved Stints & Telemetry Runs with Export Controls */}
      {stintHistory.length > 0 && (
        <Card className="p-4 space-y-3 bg-[#0e0e16] border-white/10">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-gray-400">
              <History size={14} className="text-emerald-400" />
              <span>SAVED STINTS &amp; TELEMETRY RUNS</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              {stintHistory.length} Saved {stintHistory.length === 1 ? 'Run' : 'Runs'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5 font-mono text-xs">
            {stintHistory.map(stint => (
              <div key={stint.id} className="p-3.5 bg-black/50 border border-white/10 rounded-xl space-y-2.5 hover:border-emerald-500/30 transition-colors">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-sm">{stint.carName}</span>
                  <span className="text-[10px] text-gray-500">{stint.startTime}</span>
                </div>

                {/* Stint Key Stats */}
                <div className="grid grid-cols-4 gap-2 text-[10px] bg-white/5 p-2 rounded-lg border border-white/5">
                  <div>
                    <span className="text-gray-500 block text-[8px] uppercase">Duration</span>
                    <span className="font-bold text-white">{Math.floor(stint.durationSec / 60)}m {stint.durationSec % 60}s</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[8px] uppercase">Top Speed</span>
                    <span className="font-bold text-emerald-400">{stint.topSpeedMph} MPH</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[8px] uppercase">Peak G</span>
                    <span className="font-bold text-white">{stint.peakLatG} G</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[8px] uppercase">Bottom-Outs</span>
                    <span className={`font-bold ${stint.bottomOuts > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                      {stint.bottomOuts}x
                    </span>
                  </div>
                </div>

                {/* Stint Export Action Toolbar */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    {/* JSON Export */}
                    <button
                      onClick={() => exportJson(stint)}
                      title="Download JSON Telemetry payload"
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-emerald-500/20 text-[10px] text-gray-300 hover:text-emerald-300 border border-white/10 transition-colors cursor-pointer"
                    >
                      <Download size={11} />
                      <span>JSON</span>
                    </button>

                    {/* CSV Export */}
                    <button
                      onClick={() => exportCsv(stint)}
                      title="Download CSV for Excel / MoTeC"
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-cyan-500/20 text-[10px] text-gray-300 hover:text-cyan-300 border border-white/10 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet size={11} />
                      <span>CSV</span>
                    </button>

                    {/* Copy Markdown Debrief */}
                    <button
                      onClick={() => copyReport(stint)}
                      title="Copy Stint Debrief to clipboard"
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-amber-500/20 text-[10px] text-gray-300 hover:text-amber-300 border border-white/10 transition-colors cursor-pointer"
                    >
                      {copiedId === stint.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      <span>{copiedId === stint.id ? 'Copied' : 'Debrief'}</span>
                    </button>
                  </div>

                  {/* Delete Stint */}
                  <button
                    onClick={() => deleteStint(stint.id)}
                    title="Delete Stint from garage"
                    className="p-1.5 rounded bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
