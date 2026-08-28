import { useState, useEffect, useRef } from 'react';
import { useTelemetry } from '../hooks/useTelemetry';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { getCarInfo, saveCustomCar, DEFAULT_BUILD } from '../lib/cars';
import { calculateForzaTune, type TuningGoal, type HandlingBalance, type TireCompound, type DrivetrainType } from '../lib/forzaCalculator';
import { 
  Wrench, 
  Sparkles, 
  Sliders, 
  Copy, 
  Check, 
  Save, 
  RotateCcw, 
  RefreshCw,
  Calculator,
  ChevronDown,
  ChevronUp,
  Edit3,
  X,
  Disc,
  Compass,
  Activity,
  Layers,
  Cpu,
  CircleDot,
  Wind,
  Gauge,
  type LucideIcon
} from 'lucide-react';
import { motion } from 'framer-motion';

interface TuneSection {
  id: 'tires' | 'alignment' | 'arbs' | 'springs' | 'damping' | 'diff' | 'brakes' | 'aero' | 'gearing';
  label: string;
  Icon: LucideIcon;
}

// User's exact baseline setup (Front Pressure = 2.1 BAR, Rear Pressure = 1.4 BAR)
const DEFAULT_USER_TUNE = {
  // Tires (BAR)
  tirePressureFrontBar: 2.1,
  tirePressureRearBar: 1.4,
  // Alignment
  camberFront: -2.4,
  camberRear: -1.3,
  toeFront: 0.1,
  toeRear: 0.0,
  caster: 7.0,
  // ARBs (1.0 - 65.0)
  arbFront: 7.8,
  arbRear: 53.7,
  // Springs (N/mm & cm)
  springsFrontNmm: 767.0,
  springsRearNmm: 1804.4,
  rideHeightFrontCm: 17.2,
  rideHeightRearCm: 20.0,
  // Damping (1.0 - 20.0)
  reboundFront: 10.5,
  reboundRear: 8.8,
  bumpFront: 4.4,
  bumpRear: 4.6,
  // Diff (%)
  diffAccelRear: 55,
  diffDecelRear: 0,
  // Brakes (%)
  brakeBalance: 45,
  brakePressure: 92,
  // Aero (KGF)
  aeroFrontKgf: 96,
  aeroRearKgf: 176,
  // Gearing
  finalDrive: 3.55,
  gear1: 2.89,
  gear2: 1.98,
  gear3: 1.48,
  gear4: 1.18,
  gear5: 0.94,
  gear6: 0.78,
  gear7: 0.68,
  gear8: 0.60,
  gear9: 0.54,
  gear10: 0.50,
};

export function TuningBenchPage() {
  const { telemetry } = useTelemetry();
  const [activeSection, setActiveSection] = useState<TuneSection['id']>('tires');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showQuickEditor, setShowQuickEditor] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showCompoundModal, setShowCompoundModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showAeroModal, setShowAeroModal] = useState(false);
  const [customCarName, setCustomCarName] = useState('');
  const [customCarManufacturer, setCustomCarManufacturer] = useState('');

  // Calculator Inputs
  const [calcGoal, setCalcGoal] = useState<TuningGoal>('circuit');
  const [calcDrivetrain, setCalcDrivetrain] = useState<DrivetrainType>('rwd');
  const [calcCompound, setCalcCompound] = useState<TireCompound>('slick');
  const [calcBalance, setCalcBalance] = useState<HandlingBalance>('neutral');
  const [calcWeight, setCalcWeight] = useState(3300);
  const [calcFrontWeight, setCalcFrontWeight] = useState(52);
  const [calcHp, setCalcHp] = useState(645);

  // Load custom saved baseline or default to user's specs
  const [tune, setTune] = useState<typeof DEFAULT_USER_TUNE>(() => {
    try {
      const saved = localStorage.getItem('forza_user_active_tune');
      return saved ? { ...DEFAULT_USER_TUNE, ...JSON.parse(saved) } : DEFAULT_USER_TUNE;
    } catch {
      return DEFAULT_USER_TUNE;
    }
  });

  // Persistent AI Targets & Event Counts (Hold memory so targets NEVER disappear fast)
  const [aiTargets, setAiTargets] = useState<Partial<typeof DEFAULT_USER_TUNE>>({});
  const [aiReasons, setAiReasons] = useState<Record<string, string>>({});
  const [aiCounts, setAiCounts] = useState<Record<string, number>>({});

  const saveTuneToGarage = () => {
    try {
      localStorage.setItem('forza_user_active_tune', JSON.stringify(tune));
      setSavedSuccess(true);
      setShowQuickEditor(false);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const resetToDefaultSetup = () => {
    setTune(DEFAULT_USER_TUNE);
    localStorage.removeItem('forza_user_active_tune');
  };

  const clearAiTargets = () => {
    setAiTargets({});
    setAiReasons({});
    setAiCounts({});
  };

  const [autoDetectStatus, setAutoDetectStatus] = useState<string | null>(null);

  const handleAutoDetectBuild = () => {
    const peakG = Math.abs(data.acceleration_x || 0) / 9.81;
    let detectedCompound: TireCompound = 'slick';
    if (peakG >= 1.85) {
      detectedCompound = 'slick';
    } else if (peakG >= 1.4) {
      detectedCompound = 'semi-slick';
    } else if (peakG >= 1.1) {
      detectedCompound = 'sport';
    } else {
      detectedCompound = 'street';
    }

    let detectedAero: 'full' | 'rear_only' | 'none' = 'full';
    const currentSpeed = data.speed_mph || 0;
    const avgSusp = ((data.susp_fl || 0.5) + (data.susp_fr || 0.5) + (data.susp_rl || 0.5) + (data.susp_rr || 0.5)) / 4;
    
    if (currentSpeed > 100 && avgSusp > 0.6) {
      detectedAero = 'full';
    } else if (currentSpeed > 100 && ((data.susp_rl || 0.5) + (data.susp_rr || 0.5)) / 2 > 0.6) {
      detectedAero = 'rear_only';
    }

    if (data.car_ordinal) {
      saveCustomCar(data.car_ordinal, {
        build: {
          ...(carInfo.build || DEFAULT_BUILD),
          tireCompound: detectedCompound,
          aeroType: detectedAero,
        }
      });
      setAutoDetectStatus(`Detected: ${detectedCompound.toUpperCase()} • ${detectedAero.toUpperCase()} AERO`);
      setTimeout(() => setAutoDetectStatus(null), 3500);
    }
  };

  // Generate and Apply Tune from Mathematical Engine
  const handleApplyGeneratedTune = () => {
    const calculated = calculateForzaTune({
      hp: calcHp,
      torque: 600,
      weightLbs: calcWeight,
      frontWeightPct: calcFrontWeight,
      drivetrain: calcDrivetrain,
      engineLocation: 'front',
      tireCompound: calcCompound,
      carClass: 's1',
      gearCount: 6,
      goal: calcGoal,
      balanceFix: calcBalance,
    });

    const newTune = {
      ...tune,
      tirePressureFrontBar: calculated.tires.frontBar,
      tirePressureRearBar: calculated.tires.rearBar,
      camberFront: calculated.alignment.camberFront,
      camberRear: calculated.alignment.camberRear,
      toeFront: calculated.alignment.toeFront,
      toeRear: calculated.alignment.toeRear,
      caster: calculated.alignment.caster,
      arbFront: calculated.arbs.front,
      arbRear: calculated.arbs.rear,
      springsFrontNmm: calculated.springs.frontNmm,
      springsRearNmm: calculated.springs.rearNmm,
      rideHeightFrontCm: calculated.springs.rideHeightFrontCm,
      rideHeightRearCm: calculated.springs.rideHeightRearCm,
      reboundFront: calculated.damping.reboundFront,
      reboundRear: calculated.damping.reboundRear,
      bumpFront: calculated.damping.bumpFront,
      bumpRear: calculated.damping.bumpRear,
      diffAccelRear: calculated.differential.rearAccel,
      diffDecelRear: calculated.differential.rearDecel,
      brakeBalance: calculated.brakes.balanceFront,
      aeroFrontKgf: calculated.aero.frontKgf,
      aeroRearKgf: calculated.aero.rearKgf,
      finalDrive: calculated.gearing.finalDrive,
    };

    setTune(newTune);
    localStorage.setItem('forza_user_active_tune', JSON.stringify(newTune));
    setSavedSuccess(true);
    setShowCalculator(false);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  // Fallback telemetry
  const data = telemetry || {
    speed_mph: 0,
    current_engine_rpm: 0,
    engine_max_rpm: 8500,
    gear: 0,
    accel: 0,
    brake: 0,
    tire_temp_fl: 195,
    tire_temp_fr: 198,
    tire_temp_rl: 225,
    tire_temp_rr: 228,
    tire_slip_fl: 0.4,
    tire_slip_fr: 0.4,
    tire_slip_rl: 1.1,
    tire_slip_rr: 1.1,
    susp_fl: 0.5,
    susp_fr: 0.5,
    susp_rl: 0.5,
    susp_rr: 0.5,
    acceleration_x: 0,
    acceleration_z: 0,
    car_class_name: 'S1',
    car_performance_index: 895,
    car_ordinal: 0,
  };

  // Cooldown timers and evaluation throttle
  const lastEvalTime = useRef<number>(0);
  const lastEventCooldown = useRef<Record<string, number>>({});

  // Evaluate driving physics with throttling and event cooldowns
  useEffect(() => {
    if (data.speed_mph < 15) return;

    const now = Date.now();
    if (now - lastEvalTime.current < 600) return;
    lastEvalTime.current = now;

    const maxRearT = Math.max(data.tire_temp_rl, data.tire_temp_rr);
    const maxFrontT = Math.max(data.tire_temp_fl, data.tire_temp_fr);
    const frontSlip = Math.max(data.tire_slip_fl, data.tire_slip_fr);
    const rearSlip = Math.max(data.tire_slip_rl, data.tire_slip_rr);

    const updates: Partial<typeof DEFAULT_USER_TUNE> = {};
    const newReasons: Record<string, string> = {};
    const triggeredEvents: string[] = [];

    const triggerEvent = (key: keyof typeof DEFAULT_USER_TUNE, val: number, reason: string) => {
      // 5-second cooldown per specific issue so count doesn't artificially inflate
      if (!lastEventCooldown.current[key] || now - lastEventCooldown.current[key] > 5000) {
        lastEventCooldown.current[key] = now;
        (updates as any)[key] = val;
        newReasons[key] = reason;
        triggeredEvents.push(key);
      }
    };

    // 1. Tire Pressures (in BAR)
    if (maxRearT > 240) {
      triggerEvent('tirePressureRearBar', Number((tune.tirePressureRearBar - 0.1).toFixed(2)), `Rear tires overheating (${Math.round(maxRearT)}°F). Lower rear pressure to expand contact patch.`);
    }
    if (maxFrontT > 240) {
      triggerEvent('tirePressureFrontBar', Number((tune.tirePressureFrontBar - 0.1).toFixed(2)), `Front tires overheating (${Math.round(maxFrontT)}°F). Lower front pressure to reduce scrubbing.`);
    }

    // 2. Camber recommendations
    if (frontSlip > 0.85 || maxFrontT > maxRearT + 30) {
      triggerEvent('camberFront', Number((tune.camberFront - 0.3).toFixed(1)), 'High front cornering slide detected. Stiffen negative front camber for extra bite.');
    }
    if (rearSlip > 1.3) {
      triggerEvent('camberRear', Number((tune.camberRear - 0.2).toFixed(1)), 'High rear slide under power. Adding negative rear camber stabilizes corner exit.');
    }

    // 3. Springs & Ride Height (Bottom-out detection only under active high-speed load)
    if (data.speed_mph > 35 && data.susp_fl > 0 && (data.susp_fl < 0.02 || data.susp_fr < 0.02)) {
      triggerEvent('springsFrontNmm', Number((tune.springsFrontNmm * 1.12).toFixed(1)), 'Front dampers bottomed out on bump stops. Stiffen front springs.');
      triggerEvent('rideHeightFrontCm', Number((tune.rideHeightFrontCm + 1.0).toFixed(1)), 'Raise front ride height to clear threshold braking compression.');
    }

    // 4. Anti-Roll Bars (Rear ARB 53.7 vs Front 7.8)
    if (rearSlip > frontSlip + 0.7 && data.speed_mph > 35) {
      triggerEvent('arbRear', Number(Math.max(20, tune.arbRear - 8.0).toFixed(1)), `Rear ARB (${tune.arbRear}) is very stiff relative to front (${tune.arbFront}). Soften rear ARB to calm snap oversteer.`);
    } else if (frontSlip > rearSlip + 0.6 && data.speed_mph > 35) {
      triggerEvent('arbFront', Number(Math.max(1, tune.arbFront - 2.0).toFixed(1)), 'Corner entry understeer. Soften front ARB to allow front axle to load grip.');
    }

    // 5. Differential
    if (rearSlip > 1.35 && data.accel > 190) {
      triggerEvent('diffAccelRear', Math.max(30, tune.diffAccelRear - 10), 'Rear wheels spinning up aggressively under throttle. Lower Acceleration Lock for smoother drive.');
    }

    // 6. Brake Balance
    if (data.brake > 225 && (data.tire_slip_fl > 1.4 || data.tire_slip_fr > 1.4)) {
      triggerEvent('brakeBalance', Math.max(40, tune.brakeBalance - 3), 'Front wheels locking up under hard braking. Shift brake bias rearward (-3%).');
    }

    // Batch update state cleanly
    if (triggeredEvents.length > 0) {
      setAiTargets(prev => ({ ...prev, ...updates }));
      setAiReasons(prev => ({ ...prev, ...newReasons }));
      setAiCounts(prev => {
        const next = { ...prev };
        triggeredEvents.forEach(k => {
          next[k] = (next[k] || 0) + 1;
        });
        return next;
      });
    }
  }, [data, tune]);

  const sections: TuneSection[] = [
    { id: 'tires', label: 'Tires & Pressure', Icon: Disc },
    { id: 'alignment', label: 'Alignment & Camber', Icon: Compass },
    { id: 'arbs', label: 'Anti-Roll Bars', Icon: Sliders },
    { id: 'springs', label: 'Springs & Height', Icon: Activity },
    { id: 'damping', label: 'Damping & Shocks', Icon: Layers },
    { id: 'diff', label: 'Differential', Icon: Cpu },
    { id: 'brakes', label: 'Brakes & Bias', Icon: CircleDot },
    { id: 'aero', label: 'Aerodynamics', Icon: Wind },
    { id: 'gearing', label: 'Gear Ratios', Icon: Gauge },
  ];

  const handleSaveCarName = () => {
    if (data.car_ordinal && customCarName.trim()) {
      saveCustomCar(data.car_ordinal, {
        name: customCarName.trim(),
        manufacturer: customCarManufacturer.trim() || 'Custom',
      });
      setShowRenameModal(false);
    }
  };

  const copyTuneSheet = () => {
    const activeCar = getCarInfo(data.car_ordinal, data.car_class_name, data.car_performance_index);
    const sheet = `GRIDPULSE FORZA TUNING SETUP SHEET
Vehicle: ${activeCar.manufacturer} ${activeCar.name} (${data.car_class_name} ${data.car_performance_index}) [Ordinal: ${data.car_ordinal}]

TIRES:
- Front: ${aiTargets.tirePressureFrontBar ?? tune.tirePressureFrontBar} BAR (baseline: ${tune.tirePressureFrontBar} BAR)
- Rear: ${aiTargets.tirePressureRearBar ?? tune.tirePressureRearBar} BAR (baseline: ${tune.tirePressureRearBar} BAR)

ALIGNMENT:
- Camber Front: ${aiTargets.camberFront ?? tune.camberFront}° (baseline: ${tune.camberFront}°)
- Camber Rear: ${aiTargets.camberRear ?? tune.camberRear}° (baseline: ${tune.camberRear}°)
- Toe: ${tune.toeFront}° Front / ${tune.toeRear}° Rear
- Caster: ${tune.caster}°

ANTI-ROLL BARS:
- Front: ${aiTargets.arbFront ?? tune.arbFront} (baseline: ${tune.arbFront})
- Rear: ${aiTargets.arbRear ?? tune.arbRear} (baseline: ${tune.arbRear})

SPRINGS & RIDE HEIGHT:
- Front Springs: ${aiTargets.springsFrontNmm ?? tune.springsFrontNmm} N/mm (baseline: ${tune.springsFrontNmm} N/mm)
- Rear Springs: ${aiTargets.springsRearNmm ?? tune.springsRearNmm} N/mm (baseline: ${tune.springsRearNmm} N/mm)
- Ride Height: ${aiTargets.rideHeightFrontCm ?? tune.rideHeightFrontCm} cm Front / ${aiTargets.rideHeightRearCm ?? tune.rideHeightRearCm} cm Rear

DAMPING:
- Rebound: ${tune.reboundFront} Front / ${tune.reboundRear} Rear
- Bump: ${tune.bumpFront} Front / ${tune.bumpRear} Rear

DIFFERENTIAL:
- Rear Accel: ${aiTargets.diffAccelRear ?? tune.diffAccelRear}% (baseline: ${tune.diffAccelRear}%)
- Rear Decel: ${tune.diffDecelRear}%

BRAKES:
- Balance: ${aiTargets.brakeBalance ?? tune.brakeBalance}% Front (baseline: ${tune.brakeBalance}%)
- Pressure: ${tune.brakePressure}%`;

    navigator.clipboard.writeText(sheet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Reusable Slider Component with Persistent AI Target Overlay
  const TuneSlider = ({
    targetKey,
    label,
    current,
    min,
    max,
    step,
    unit = '',
    onChange,
  }: {
    targetKey: keyof typeof DEFAULT_USER_TUNE;
    label: string;
    current: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    onChange: (val: number) => void;
  }) => {
    const recommended = aiTargets[targetKey] !== undefined ? (aiTargets[targetKey] as number) : current;
    const reason = aiReasons[targetKey];
    const eventCount = aiCounts[targetKey] || 0;
    const hasDelta = Math.abs(current - recommended) > 0.001;

    const currentPct = Math.min(100, Math.max(0, ((current - min) / (max - min)) * 100));
    const recPct = Math.min(100, Math.max(0, ((recommended - min) / (max - min)) * 100));

    return (
      <div className="bg-black/50 border border-white/10 rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-gray-300 uppercase">{label}</span>
          
          <div className="flex items-center gap-2">
            {/* Current Value Editable Input */}
            <div className="flex items-center gap-1 text-xs font-mono font-bold text-white bg-black/70 px-2 py-0.5 rounded border border-white/20">
              <span className="text-gray-400 text-[10px]">CURRENT:</span>
              <input
                type="number"
                step={step}
                value={current}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) onChange(val);
                }}
                className="w-14 bg-transparent text-white font-bold font-mono text-xs outline-none text-right"
              />
              <span className="text-gray-400 text-[10px]">{unit}</span>
            </div>

            {/* AI Target Overlay Value */}
            {hasDelta && (
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40 flex items-center gap-1">
                <Sparkles size={11} /> Target: {recommended}{unit}
                {eventCount > 1 && (
                  <span className="ml-1 text-[9px] bg-emerald-500/30 px-1 rounded text-emerald-300">
                    {eventCount}x
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Dual Layer Visual Slider */}
        <div className="relative w-full h-7 flex items-center">
          {/* Track Bar */}
          <div className="w-full h-2 bg-black/80 rounded-full border border-white/10 relative overflow-hidden">
            {/* Current Fill */}
            <div 
              className="h-full bg-gray-500/40 rounded-full"
              style={{ width: `${currentPct}%` }}
            />
          </div>

          {/* Recommended Target Marker */}
          {hasDelta && (
            <motion.div
              className="absolute z-20 top-0.5 -ml-2 flex flex-col items-center pointer-events-none"
              style={{ left: `${recPct}%` }}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
            >
              <div className="w-4 h-4 bg-emerald-400 border border-black rounded-sm rotate-45 shadow-[0_0_14px_#00ff88]" />
              <span className="text-[8px] font-mono font-black text-emerald-400 mt-1 uppercase">TARGET</span>
            </motion.div>
          )}

          {/* Interactive Native Slider */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={current}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer z-30"
          />
        </div>

        {/* Range Min/Max Labels */}
        <div className="flex justify-between text-[9px] font-mono text-gray-500">
          <span>{min}{unit}</span>
          <span>{max}{unit}</span>
        </div>

        {/* Diagnostic Reason */}
        {reason && (
          <div className="text-[11px] font-mono text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 p-2 rounded-lg flex items-start gap-1.5 mt-1">
            <Wrench size={13} className="text-emerald-400 shrink-0 mt-0.5" />
            <span>{reason}</span>
          </div>
        )}
      </div>
    );
  };

  const carInfo = getCarInfo(data.car_ordinal, data.car_class_name, data.car_performance_index);
  const activeTargetsCount = Object.keys(aiTargets).length;

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 pb-36 landscape:pb-16">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-[#111118] via-[#161622] to-[#111118] p-4 rounded-2xl border border-white/10 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Sliders size={20} />
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
                {carInfo.name}
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
                <Edit3 size={11} />
                <span>Rename</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <button
            type="button"
            onPointerDown={() => setShowQuickEditor(!showQuickEditor)}
            onClick={() => setShowQuickEditor(!showQuickEditor)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 active:bg-purple-500/40 text-purple-300 text-xs font-mono font-bold border border-purple-500/40 transition-colors cursor-pointer touch-manipulation"
          >
            <Edit3 size={14} />
            <span>Tune Sheet</span>
          </button>

          <button
            type="button"
            onPointerDown={() => setShowCalculator(!showCalculator)}
            onClick={() => setShowCalculator(!showCalculator)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 active:bg-cyan-500/35 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/30 transition-colors cursor-pointer touch-manipulation"
          >
            <Calculator size={14} />
            <span>Auto-Tune</span>
            {showCalculator ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {activeTargetsCount > 0 && (
            <button
              type="button"
              onPointerDown={clearAiTargets}
              onClick={clearAiTargets}
              title="Clear active AI targets and re-evaluate"
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-300 text-xs font-mono font-bold border border-red-500/30 transition-colors cursor-pointer touch-manipulation"
            >
              <RefreshCw size={13} />
              <span>Clear ({activeTargetsCount})</span>
            </button>
          )}

          <button
            type="button"
            onPointerDown={saveTuneToGarage}
            onClick={saveTuneToGarage}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-mono font-bold uppercase transition-colors cursor-pointer touch-manipulation"
          >
            {savedSuccess ? <Check size={13} className="text-emerald-400" /> : <Save size={13} />}
            <span>{savedSuccess ? 'Saved!' : 'Save Baseline'}</span>
          </button>

          <button
            type="button"
            onPointerDown={resetToDefaultSetup}
            onClick={resetToDefaultSetup}
            title="Reset to default baseline"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/20 text-gray-400 hover:text-white transition-colors cursor-pointer touch-manipulation"
          >
            <RotateCcw size={14} />
          </button>

          <button
            type="button"
            onPointerDown={copyTuneSheet}
            onClick={copyTuneSheet}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black text-xs font-mono font-bold uppercase transition-colors shadow-[0_0_15px_rgba(0,255,136,0.3)] cursor-pointer touch-manipulation"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy Tune'}</span>
          </button>
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

      {/* Active Car Build & Tire Compound Selector Bar */}
      <div className="bg-[#111118] border border-white/10 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-white uppercase">Vehicle Configuration</span>
            <span className="text-[10px] font-mono text-gray-500">• Calibrates AI thermal &amp; grip thresholds</span>
          </div>
          
          <div className="flex items-center gap-2">
            {autoDetectStatus ? (
              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40 animate-pulse">
                {autoDetectStatus}
              </span>
            ) : (
              <button
                type="button"
                onPointerDown={handleAutoDetectBuild}
                onClick={handleAutoDetectBuild}
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 hover:bg-cyan-500/20 active:bg-cyan-500/30 transition-colors cursor-pointer touch-manipulation flex items-center gap-1"
                title="Auto-detect tire grip and aero downforce from live physics"
              >
                <Sparkles size={11} />
                <span>Auto-Detect Build</span>
              </button>
            )}
            
            <div className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {carInfo.build?.tireCompound.toUpperCase()} TIRES • {carInfo.build?.tuningGoal.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          {/* Tire Compound 1-Tap Selector */}
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
              <Disc size={11} className="text-emerald-400" />
              <span>Tire Compound</span>
            </span>
            <button
              type="button"
              onPointerDown={() => setShowCompoundModal(true)}
              onClick={() => setShowCompoundModal(true)}
              className="w-full bg-black/60 hover:bg-black/80 active:bg-black border border-white/20 hover:border-emerald-400 rounded-lg p-2 text-left text-white font-mono text-xs cursor-pointer touch-manipulation flex items-center justify-between transition-all"
            >
              <span className="font-bold text-emerald-400">
                {carInfo.build?.tireCompound ? carInfo.build.tireCompound.toUpperCase() : 'SLICK'}
              </span>
              <ChevronDown size={13} className="text-gray-400" />
            </button>
          </div>

          {/* Tuning Goal 1-Tap Selector */}
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
              <Gauge size={11} className="text-cyan-400" />
              <span>Tuning Goal</span>
            </span>
            <button
              type="button"
              onPointerDown={() => setShowGoalModal(true)}
              onClick={() => setShowGoalModal(true)}
              className="w-full bg-black/60 hover:bg-black/80 active:bg-black border border-white/20 hover:border-cyan-400 rounded-lg p-2 text-left text-white font-mono text-xs cursor-pointer touch-manipulation flex items-center justify-between transition-all"
            >
              <span className="font-bold text-cyan-400">
                {carInfo.build?.tuningGoal ? carInfo.build.tuningGoal.toUpperCase() : 'CIRCUIT'}
              </span>
              <ChevronDown size={13} className="text-gray-400" />
            </button>
          </div>

          {/* Aero Level 1-Tap Selector */}
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
              <Wind size={11} className="text-purple-400" />
              <span>Aero Package</span>
            </span>
            <button
              type="button"
              onPointerDown={() => setShowAeroModal(true)}
              onClick={() => setShowAeroModal(true)}
              className="w-full bg-black/60 hover:bg-black/80 active:bg-black border border-white/20 hover:border-purple-400 rounded-lg p-2 text-left text-white font-mono text-xs cursor-pointer touch-manipulation flex items-center justify-between transition-all"
            >
              <span className="font-bold text-purple-400">
                {carInfo.build?.aeroType ? carInfo.build.aeroType.toUpperCase() : 'FULL'}
              </span>
              <ChevronDown size={13} className="text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* 1-Tap Compound Modal */}
      {showCompoundModal && (
        <Card className="p-4 space-y-3 bg-[#161624] border-emerald-500/40 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-mono font-bold text-white uppercase flex items-center gap-1.5">
              <Disc size={13} className="text-emerald-400" />
              Select Active Tire Compound
            </span>
            <button 
              type="button"
              onPointerDown={() => setShowCompoundModal(false)}
              onClick={() => setShowCompoundModal(false)} 
              className="text-gray-400 hover:text-white p-1 touch-manipulation cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
            {[
              { id: 'slick', name: 'Race Slicks', desc: 'Optimum Window 210–245°F • Max Grip' },
              { id: 'semi-slick', name: 'Semi-Slick', desc: 'Optimum Window 200–230°F • High Grip' },
              { id: 'sport', name: 'Sport Compound', desc: 'Optimum Window 180–215°F • Fast Street' },
              { id: 'street', name: 'Street Compound', desc: 'Optimum Window 160–195°F • Standard' },
              { id: 'drift', name: 'Drift Compound', desc: 'Sustained Slip & High Heat Tolerant' },
              { id: 'rally', name: 'Rally Compound', desc: 'Soft Block Gravel & Dirt Grip' },
              { id: 'drag', name: 'Drag Slicks', desc: 'Low PSI High Wrinkle Launch' },
              { id: 'offroad', name: 'Off-Road Tires', desc: 'Deep Tread Mud & Sand' },
            ].map(comp => {
              const isCurrent = (carInfo.build?.tireCompound || 'slick') === comp.id;
              return (
                <button
                  key={comp.id}
                  type="button"
                  onPointerDown={() => {
                    saveCustomCar(data.car_ordinal, {
                      build: {
                        ...(carInfo.build || DEFAULT_BUILD),
                        tireCompound: comp.id as any,
                      }
                    });
                    setShowCompoundModal(false);
                  }}
                  onClick={() => {
                    saveCustomCar(data.car_ordinal, {
                      build: {
                        ...(carInfo.build || DEFAULT_BUILD),
                        tireCompound: comp.id as any,
                      }
                    });
                    setShowCompoundModal(false);
                  }}
                  className={`p-3 rounded-xl text-left border transition-all cursor-pointer touch-manipulation flex items-center justify-between ${
                    isCurrent 
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow' 
                      : 'bg-black/60 border-white/10 hover:border-white/30 text-gray-300 active:bg-white/10'
                  }`}
                >
                  <div>
                    <span className="font-bold text-xs block text-white">{comp.name}</span>
                    <span className="text-[10px] text-gray-400">{comp.desc}</span>
                  </div>
                  {isCurrent && <Check size={14} className="text-emerald-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* 1-Tap Goal Modal */}
      {showGoalModal && (
        <Card className="p-4 space-y-3 bg-[#161624] border-cyan-500/40 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-mono font-bold text-white uppercase flex items-center gap-1.5">
              <Gauge size={13} className="text-cyan-400" />
              Select Tuning Discipline
            </span>
            <button 
              type="button"
              onPointerDown={() => setShowGoalModal(false)}
              onClick={() => setShowGoalModal(false)} 
              className="text-gray-400 hover:text-white p-1 touch-manipulation cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
            {[
              { id: 'circuit', name: 'Circuit / Track Racing', desc: 'Cornering Grip & Neutral Balance' },
              { id: 'drift', name: 'Drift King', desc: 'Fast Oversteer & Controlled Angle' },
              { id: 'drag', name: 'Drag Strip', desc: 'Maximum Straight-Line Launch' },
              { id: 'touge', name: 'Touge Mountain Pass', desc: 'Agile Direction Changes' },
              { id: 'rally', name: 'Rally / Dirt', desc: 'Soft Damping & Long Travel' },
              { id: 'speed', name: 'Top Speed Highway', desc: 'Low Drag & High Gearing' },
            ].map(g => {
              const isCurrent = (carInfo.build?.tuningGoal || 'circuit') === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onPointerDown={() => {
                    saveCustomCar(data.car_ordinal, {
                      build: {
                        ...(carInfo.build || DEFAULT_BUILD),
                        tuningGoal: g.id as any,
                      }
                    });
                    setShowGoalModal(false);
                  }}
                  onClick={() => {
                    saveCustomCar(data.car_ordinal, {
                      build: {
                        ...(carInfo.build || DEFAULT_BUILD),
                        tuningGoal: g.id as any,
                      }
                    });
                    setShowGoalModal(false);
                  }}
                  className={`p-3 rounded-xl text-left border transition-all cursor-pointer touch-manipulation flex items-center justify-between ${
                    isCurrent 
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow' 
                      : 'bg-black/60 border-white/10 hover:border-white/30 text-gray-300 active:bg-white/10'
                  }`}
                >
                  <div>
                    <span className="font-bold text-xs block text-white">{g.name}</span>
                    <span className="text-[10px] text-gray-400">{g.desc}</span>
                  </div>
                  {isCurrent && <Check size={14} className="text-cyan-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* 1-Tap Aero Modal */}
      {showAeroModal && (
        <Card className="p-4 space-y-3 bg-[#161624] border-purple-500/40 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-mono font-bold text-white uppercase flex items-center gap-1.5">
              <Wind size={13} className="text-purple-400" />
              Select Aero Package
            </span>
            <button 
              type="button"
              onPointerDown={() => setShowAeroModal(false)}
              onClick={() => setShowAeroModal(false)} 
              className="text-gray-400 hover:text-white p-1 touch-manipulation cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
            {[
              { id: 'full', name: 'Full Race Aero', desc: 'Front Splitter & Rear Wing' },
              { id: 'rear_only', name: 'Rear Wing Only', desc: 'High Rear Downforce' },
              { id: 'none', name: 'Stock Body', desc: 'No Downforce Added' },
            ].map(a => {
              const isCurrent = (carInfo.build?.aeroType || 'full') === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onPointerDown={() => {
                    saveCustomCar(data.car_ordinal, {
                      build: {
                        ...(carInfo.build || DEFAULT_BUILD),
                        aeroType: a.id as any,
                      }
                    });
                    setShowAeroModal(false);
                  }}
                  onClick={() => {
                    saveCustomCar(data.car_ordinal, {
                      build: {
                        ...(carInfo.build || DEFAULT_BUILD),
                        aeroType: a.id as any,
                      }
                    });
                    setShowAeroModal(false);
                  }}
                  className={`p-3 rounded-xl text-left border transition-all cursor-pointer touch-manipulation flex items-center justify-between ${
                    isCurrent 
                      ? 'bg-purple-500/20 border-purple-400 text-white shadow' 
                      : 'bg-black/60 border-white/10 hover:border-white/30 text-gray-300 active:bg-white/10'
                  }`}
                >
                  <div>
                    <span className="font-bold text-xs block text-white">{a.name}</span>
                    <span className="text-[10px] text-gray-400">{a.desc}</span>
                  </div>
                  {isCurrent && <Check size={14} className="text-purple-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* QUICK TUNE SHEET MODAL */}
      {showQuickEditor && (
        <Card className="p-5 space-y-4 bg-[#141422] border-purple-500/40 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <Edit3 size={18} className="text-purple-400" />
              <h2 className="text-sm sm:text-base font-mono font-bold text-white uppercase">
                Quick Setup Sheet — Enter In-Game Values
              </h2>
            </div>
            <button
              type="button"
              onPointerDown={() => setShowQuickEditor(false)}
              onClick={() => setShowQuickEditor(false)}
              className="text-gray-400 hover:text-white p-1 touch-manipulation cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 font-mono text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-emerald-400 uppercase font-bold">Front Tire Pressure (BAR)</label>
              <input
                type="number"
                step={0.05}
                value={tune.tirePressureFrontBar}
                onChange={(e) => setTune(t => ({ ...t, tirePressureFrontBar: parseFloat(e.target.value) || 2.1 }))}
                className="w-full bg-black border border-white/20 rounded-lg p-2 text-white font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-emerald-400 uppercase font-bold">Rear Tire Pressure (BAR)</label>
              <input
                type="number"
                step={0.05}
                value={tune.tirePressureRearBar}
                onChange={(e) => setTune(t => ({ ...t, tirePressureRearBar: parseFloat(e.target.value) || 1.4 }))}
                className="w-full bg-black border border-white/20 rounded-lg p-2 text-white font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-cyan-400 uppercase font-bold">Front Camber (°)</label>
              <input
                type="number"
                step={0.1}
                value={tune.camberFront}
                onChange={(e) => setTune(t => ({ ...t, camberFront: parseFloat(e.target.value) || -2.4 }))}
                className="w-full bg-black border border-white/20 rounded-lg p-2 text-white font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-cyan-400 uppercase font-bold">Rear Camber (°)</label>
              <input
                type="number"
                step={0.1}
                value={tune.camberRear}
                onChange={(e) => setTune(t => ({ ...t, camberRear: parseFloat(e.target.value) || -1.3 }))}
                className="w-full bg-black border border-white/20 rounded-lg p-2 text-white font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-yellow-400 uppercase font-bold">Front ARB</label>
              <input
                type="number"
                step={0.1}
                value={tune.arbFront}
                onChange={(e) => setTune(t => ({ ...t, arbFront: parseFloat(e.target.value) || 7.8 }))}
                className="w-full bg-black border border-white/20 rounded-lg p-2 text-white font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-yellow-400 uppercase font-bold">Rear ARB</label>
              <input
                type="number"
                step={0.1}
                value={tune.arbRear}
                onChange={(e) => setTune(t => ({ ...t, arbRear: parseFloat(e.target.value) || 53.7 }))}
                className="w-full bg-black border border-white/20 rounded-lg p-2 text-white font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-pink-400 uppercase font-bold">Front Springs (N/mm)</label>
              <input
                type="number"
                step={1}
                value={tune.springsFrontNmm}
                onChange={(e) => setTune(t => ({ ...t, springsFrontNmm: parseFloat(e.target.value) || 767 }))}
                className="w-full bg-black border border-white/20 rounded-lg p-2 text-white font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-pink-400 uppercase font-bold">Rear Springs (N/mm)</label>
              <input
                type="number"
                step={1}
                value={tune.springsRearNmm}
                onChange={(e) => setTune(t => ({ ...t, springsRearNmm: parseFloat(e.target.value) || 1804 }))}
                className="w-full bg-black border border-white/20 rounded-lg p-2 text-white font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onPointerDown={saveTuneToGarage}
              onClick={saveTuneToGarage}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 active:bg-purple-600 text-white text-xs font-mono font-bold uppercase transition-colors shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-pointer touch-manipulation"
            >
              <Save size={14} />
              <span>Save &amp; Sync In-Game Tune</span>
            </button>
          </div>
        </Card>
      )}

      {/* MATHEMATICAL AUTO-TUNING CALCULATOR */}
      {showCalculator && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Card className="p-4 sm:p-5 space-y-4 bg-[#12121c] border-cyan-500/30">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-cyan-400" />
                <h2 className="text-sm sm:text-base font-mono font-bold text-white uppercase">
                  Forza Horizon Mathematical Tuning Generator
                </h2>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                Physics Engine
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Tuning Goal</label>
                <select
                  value={calcGoal}
                  onChange={(e) => setCalcGoal(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/20 rounded-lg p-2 text-white outline-none focus:border-cyan-400"
                >
                  <option value="circuit">Circuit / Track</option>
                  <option value="drift">Drift King</option>
                  <option value="drag">Drag Strip</option>
                  <option value="touge">Touge Mountain</option>
                  <option value="rally">Rally / Dirt</option>
                  <option value="speed">Top Speed</option>
                  <option value="offroad">Cross Country</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Drivetrain</label>
                <select
                  value={calcDrivetrain}
                  onChange={(e) => setCalcDrivetrain(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/20 rounded-lg p-2 text-white outline-none focus:border-cyan-400"
                >
                  <option value="rwd">RWD (Rear-Wheel)</option>
                  <option value="awd">AWD (All-Wheel)</option>
                  <option value="fwd">FWD (Front-Wheel)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Tire Compound</label>
                <select
                  value={calcCompound}
                  onChange={(e) => setCalcCompound(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/20 rounded-lg p-2 text-white outline-none focus:border-cyan-400"
                >
                  <option value="slick">Race Slick</option>
                  <option value="semi-slick">Semi-Slick</option>
                  <option value="sport">Sport Tires</option>
                  <option value="drift">Drift Compound</option>
                  <option value="rally">Rally Compound</option>
                  <option value="drag">Drag Slicks</option>
                  <option value="street">Street Compound</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Handling Bias</label>
                <select
                  value={calcBalance}
                  onChange={(e) => setCalcBalance(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/20 rounded-lg p-2 text-white outline-none focus:border-cyan-400"
                >
                  <option value="neutral">Neutral Balance</option>
                  <option value="understeer">Fix Understeer</option>
                  <option value="oversteer">Fix Oversteer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Curb Weight (LBS)</label>
                <input
                  type="number"
                  value={calcWeight}
                  onChange={(e) => setCalcWeight(parseInt(e.target.value, 10) || 3000)}
                  className="w-full bg-black/60 border border-white/20 rounded-lg p-2 text-white outline-none focus:border-cyan-400 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Front Weight %</label>
                <input
                  type="number"
                  value={calcFrontWeight}
                  onChange={(e) => setCalcFrontWeight(parseInt(e.target.value, 10) || 50)}
                  className="w-full bg-black/60 border border-white/20 rounded-lg p-2 text-white outline-none focus:border-cyan-400 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Horsepower (HP)</label>
                <input
                  type="number"
                  value={calcHp}
                  onChange={(e) => setCalcHp(parseInt(e.target.value, 10) || 400)}
                  className="w-full bg-black/60 border border-white/20 rounded-lg p-2 text-white outline-none focus:border-cyan-400 font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onPointerDown={handleApplyGeneratedTune}
                onClick={handleApplyGeneratedTune}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black text-xs font-mono font-bold uppercase transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer touch-manipulation"
              >
                <Sparkles size={14} />
                <span>Calculate &amp; Apply Generated Tune</span>
              </button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Section Navigation Tabs (1-Tap Instant Response, Zero Emojis) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none touch-manipulation">
        {sections.map(sec => {
          const TabIcon = sec.Icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onPointerDown={() => setActiveSection(sec.id)}
              onClick={() => setActiveSection(sec.id)}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 touch-manipulation ${
                isActive
                  ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(0,255,136,0.3)]'
                  : 'bg-[#111118] text-gray-400 hover:text-white border border-white/5 active:bg-white/10'
              }`}
            >
              <TabIcon size={14} className={isActive ? 'text-black' : 'text-gray-400'} />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Section Tuning Sliders Grid */}
      <Card className="p-4 sm:p-5 space-y-4 bg-[#0e0e16] border-white/10">
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-mono font-bold text-white uppercase">
              {sections.find(s => s.id === activeSection)?.label} Controls
            </h2>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="flex items-center gap-1 text-gray-400">
              <div className="w-2 h-2 rounded-full bg-gray-400" /> Current Baseline
            </span>
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#00ff88]" /> Recommended Target
            </span>
          </div>
        </div>

        {/* ================= TIRES ================= */}
        {activeSection === 'tires' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TuneSlider
              targetKey="tirePressureFrontBar"
              label="Front Tire Pressure"
              min={0.8}
              max={3.5}
              step={0.05}
              unit=" BAR"
              current={tune.tirePressureFrontBar}
              onChange={(val) => setTune(t => ({ ...t, tirePressureFrontBar: val }))}
            />
            <TuneSlider
              targetKey="tirePressureRearBar"
              label="Rear Tire Pressure"
              min={0.8}
              max={3.5}
              step={0.05}
              unit=" BAR"
              current={tune.tirePressureRearBar}
              onChange={(val) => setTune(t => ({ ...t, tirePressureRearBar: val }))}
            />
          </div>
        )}

        {/* ================= ALIGNMENT ================= */}
        {activeSection === 'alignment' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TuneSlider
              targetKey="camberFront"
              label="Front Camber"
              min={-5.0}
              max={0.0}
              step={0.1}
              unit="°"
              current={tune.camberFront}
              onChange={(val) => setTune(t => ({ ...t, camberFront: val }))}
            />
            <TuneSlider
              targetKey="camberRear"
              label="Rear Camber"
              min={-5.0}
              max={0.0}
              step={0.1}
              unit="°"
              current={tune.camberRear}
              onChange={(val) => setTune(t => ({ ...t, camberRear: val }))}
            />
            <TuneSlider
              targetKey="toeFront"
              label="Front Toe In / Out"
              min={-2.0}
              max={2.0}
              step={0.1}
              unit="°"
              current={tune.toeFront}
              onChange={(val) => setTune(t => ({ ...t, toeFront: val }))}
            />
            <TuneSlider
              targetKey="toeRear"
              label="Rear Toe In / Out"
              min={-2.0}
              max={2.0}
              step={0.1}
              unit="°"
              current={tune.toeRear}
              onChange={(val) => setTune(t => ({ ...t, toeRear: val }))}
            />
            <TuneSlider
              targetKey="caster"
              label="Front Caster"
              min={1.0}
              max={7.0}
              step={0.1}
              unit="°"
              current={tune.caster}
              onChange={(val) => setTune(t => ({ ...t, caster: val }))}
            />
          </div>
        )}

        {/* ================= ANTI-ROLL BARS ================= */}
        {activeSection === 'arbs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TuneSlider
              targetKey="arbFront"
              label="Front Anti-Roll Bar"
              min={1.0}
              max={65.0}
              step={0.1}
              current={tune.arbFront}
              onChange={(val) => setTune(t => ({ ...t, arbFront: val }))}
            />
            <TuneSlider
              targetKey="arbRear"
              label="Rear Anti-Roll Bar"
              min={1.0}
              max={65.0}
              step={0.1}
              current={tune.arbRear}
              onChange={(val) => setTune(t => ({ ...t, arbRear: val }))}
            />
          </div>
        )}

        {/* ================= SPRINGS ================= */}
        {activeSection === 'springs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TuneSlider
              targetKey="springsFrontNmm"
              label="Front Springs"
              min={200}
              max={2500}
              step={10}
              unit=" N/mm"
              current={tune.springsFrontNmm}
              onChange={(val) => setTune(t => ({ ...t, springsFrontNmm: val }))}
            />
            <TuneSlider
              targetKey="springsRearNmm"
              label="Rear Springs"
              min={200}
              max={2500}
              step={10}
              unit=" N/mm"
              current={tune.springsRearNmm}
              onChange={(val) => setTune(t => ({ ...t, springsRearNmm: val }))}
            />
            <TuneSlider
              targetKey="rideHeightFrontCm"
              label="Front Ride Height"
              min={5.0}
              max={30.0}
              step={0.1}
              unit=" cm"
              current={tune.rideHeightFrontCm}
              onChange={(val) => setTune(t => ({ ...t, rideHeightFrontCm: val }))}
            />
            <TuneSlider
              targetKey="rideHeightRearCm"
              label="Rear Ride Height"
              min={5.0}
              max={30.0}
              step={0.1}
              unit=" cm"
              current={tune.rideHeightRearCm}
              onChange={(val) => setTune(t => ({ ...t, rideHeightRearCm: val }))}
            />
          </div>
        )}

        {/* ================= DAMPING ================= */}
        {activeSection === 'damping' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TuneSlider
              targetKey="reboundFront"
              label="Front Rebound Stiffness"
              min={1.0}
              max={20.0}
              step={0.1}
              current={tune.reboundFront}
              onChange={(val) => setTune(t => ({ ...t, reboundFront: val }))}
            />
            <TuneSlider
              targetKey="reboundRear"
              label="Rear Rebound Stiffness"
              min={1.0}
              max={20.0}
              step={0.1}
              current={tune.reboundRear}
              onChange={(val) => setTune(t => ({ ...t, reboundRear: val }))}
            />
            <TuneSlider
              targetKey="bumpFront"
              label="Front Bump Stiffness"
              min={1.0}
              max={20.0}
              step={0.1}
              current={tune.bumpFront}
              onChange={(val) => setTune(t => ({ ...t, bumpFront: val }))}
            />
            <TuneSlider
              targetKey="bumpRear"
              label="Rear Bump Stiffness"
              min={1.0}
              max={20.0}
              step={0.1}
              current={tune.bumpRear}
              onChange={(val) => setTune(t => ({ ...t, bumpRear: val }))}
            />
          </div>
        )}

        {/* ================= DIFFERENTIAL ================= */}
        {activeSection === 'diff' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TuneSlider
              targetKey="diffAccelRear"
              label="Rear Acceleration Lock"
              min={0}
              max={100}
              step={1}
              unit="%"
              current={tune.diffAccelRear}
              onChange={(val) => setTune(t => ({ ...t, diffAccelRear: val }))}
            />
            <TuneSlider
              targetKey="diffDecelRear"
              label="Rear Deceleration Lock"
              min={0}
              max={100}
              step={1}
              unit="%"
              current={tune.diffDecelRear}
              onChange={(val) => setTune(t => ({ ...t, diffDecelRear: val }))}
            />
          </div>
        )}

        {/* ================= BRAKES ================= */}
        {activeSection === 'brakes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TuneSlider
              targetKey="brakeBalance"
              label="Brake Balance (Front Bias)"
              min={30}
              max={70}
              step={1}
              unit="% Front"
              current={tune.brakeBalance}
              onChange={(val) => setTune(t => ({ ...t, brakeBalance: val }))}
            />
            <TuneSlider
              targetKey="brakePressure"
              label="Brake Pressure"
              min={50}
              max={200}
              step={5}
              unit="%"
              current={tune.brakePressure}
              onChange={(val) => setTune(t => ({ ...t, brakePressure: val }))}
            />
          </div>
        )}

        {/* ================= AERO ================= */}
        {activeSection === 'aero' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TuneSlider
              targetKey="aeroFrontKgf"
              label="Front Downforce"
              min={20}
              max={400}
              step={2}
              unit=" KGF"
              current={tune.aeroFrontKgf}
              onChange={(val) => setTune(t => ({ ...t, aeroFrontKgf: val }))}
            />
            <TuneSlider
              targetKey="aeroRearKgf"
              label="Rear Downforce"
              min={20}
              max={600}
              step={2}
              unit=" KGF"
              current={tune.aeroRearKgf}
              onChange={(val) => setTune(t => ({ ...t, aeroRearKgf: val }))}
            />
          </div>
        )}

        {/* ================= GEARING ================= */}
        {activeSection === 'gearing' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <TuneSlider
              targetKey="finalDrive"
              label="Final Drive"
              min={2.00}
              max={5.50}
              step={0.01}
              current={tune.finalDrive}
              onChange={(val) => setTune(t => ({ ...t, finalDrive: val }))}
            />
            <TuneSlider
              targetKey="gear1"
              label="1st Gear"
              min={1.50}
              max={4.50}
              step={0.01}
              current={tune.gear1}
              onChange={(val) => setTune(t => ({ ...t, gear1: val }))}
            />
            <TuneSlider
              targetKey="gear2"
              label="2nd Gear"
              min={1.00}
              max={3.00}
              step={0.01}
              current={tune.gear2}
              onChange={(val) => setTune(t => ({ ...t, gear2: val }))}
            />
            <TuneSlider
              targetKey="gear3"
              label="3rd Gear"
              min={0.80}
              max={2.20}
              step={0.01}
              current={tune.gear3}
              onChange={(val) => setTune(t => ({ ...t, gear3: val }))}
            />
            <TuneSlider
              targetKey="gear4"
              label="4th Gear"
              min={0.60}
              max={1.80}
              step={0.01}
              current={tune.gear4}
              onChange={(val) => setTune(t => ({ ...t, gear4: val }))}
            />
            <TuneSlider
              targetKey="gear5"
              label="5th Gear"
              min={0.50}
              max={1.40}
              step={0.01}
              current={tune.gear5}
              onChange={(val) => setTune(t => ({ ...t, gear5: val }))}
            />
            <TuneSlider
              targetKey="gear6"
              label="6th Gear"
              min={0.40}
              max={1.20}
              step={0.01}
              current={tune.gear6}
              onChange={(val) => setTune(t => ({ ...t, gear6: val }))}
            />
            <TuneSlider
              targetKey="gear7"
              label="7th Gear"
              min={0.30}
              max={1.00}
              step={0.01}
              current={tune.gear7}
              onChange={(val) => setTune(t => ({ ...t, gear7: val }))}
            />
            <TuneSlider
              targetKey="gear8"
              label="8th Gear"
              min={0.25}
              max={0.90}
              step={0.01}
              current={tune.gear8}
              onChange={(val) => setTune(t => ({ ...t, gear8: val }))}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
