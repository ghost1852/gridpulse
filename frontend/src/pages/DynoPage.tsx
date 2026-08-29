import { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useTelemetry } from '../hooks/useTelemetry';
import { useUnits } from '../context/UnitContext';
import { getCarInfo } from '../lib/cars';
import { 
  getAllDynoRuns, 
  deleteDynoRun, 
  downloadDynoJsonFile, 
  globalDynoRecorder, 
  type DynoRun, 
  type DynoStage 
} from '../lib/dyno';
import { copyTextToClipboard } from '../lib/clipboard';
import { 
  ComposedChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  ReferenceLine 
} from 'recharts';
import { 
  Zap, 
  Download, 
  Trash2, 
  Check, 
  Sparkles, 
  Gauge, 
  Flame, 
  ArrowRight,
  HelpCircle,
  Cpu,
  Sliders,
  RotateCcw
} from 'lucide-react';

const GEAR_COLORS = [
  '#ef4444', // 1st - Red
  '#f97316', // 2nd - Orange
  '#f59e0b', // 3rd - Amber
  '#10b981', // 4th - Emerald
  '#06b6d4', // 5th - Cyan
  '#8b5cf6', // 6th - Purple
  '#ec4899', // 7th - Pink
  '#64748b', // 8th - Slate
];

export function DynoPage() {
  const { telemetry } = useTelemetry();
  const { convertPressure, units } = useUnits();

  const [dynoRuns, setDynoRuns] = useState<DynoRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [mode, setMode] = useState<'single_gear' | 'multi_gear'>('single_gear');
  const [targetGear, setTargetGear] = useState<number>(4);
  const [isArmed, setIsArmed] = useState(true);
  const [autoArm, setAutoArm] = useState(true);
  const [dynoStage, setDynoStage] = useState<DynoStage>('ARMED');
  const [statusDetail, setStatusDetail] = useState('WAITING FOR PULL (Floor Throttle in Gear 4)');
  const [stageProgress, setStageProgress] = useState(0);
  const [liveHp, setLiveHp] = useState(0);
  const [liveTq, setLiveTq] = useState(0);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const isFinalizing = useRef(false);

  // Load Dyno Runs from IndexedDB
  const refreshRuns = async () => {
    try {
      const list = await getAllDynoRuns();
      setDynoRuns(list);
      if (list.length > 0 && !selectedRunId) {
        setSelectedRunId(list[0].id);
      }
    } catch (e) {
      console.error('Failed to load dyno runs from IndexedDB:', e);
    }
  };

  useEffect(() => {
    refreshRuns();
  }, []);

  // Process live telemetry frame into Auto-Arming Dyno Recorder
  useEffect(() => {
    if (telemetry && isArmed) {
      const car = getCarInfo(
        telemetry.car_ordinal,
        telemetry.car_class_name,
        telemetry.car_performance_index,
        telemetry.drivetrain_name
      );

      if (!globalDynoRecorder.getIsArmed()) {
        globalDynoRecorder.arm(mode, targetGear, {
          name: car.name,
          ordinal: telemetry.car_ordinal,
          class: car.class,
          pi: car.pi,
          drivetrain: car.drivetrain
        });
      }

      const res = globalDynoRecorder.processFrame(telemetry);
      setDynoStage(res.stage);
      setStatusDetail(res.statusDetail);
      setStageProgress(res.progressPct);
      setLiveHp(res.currentHp);
      setLiveTq(res.currentTq);

      // Auto-finish & process power curve immediately upon COOLDOWN
      if (res.stage === 'COOLDOWN' && !isFinalizing.current) {
        isFinalizing.current = true;
        (async () => {
          try {
            const saved = await globalDynoRecorder.finishAndSave();
            if (saved) {
              await refreshRuns();
              setSelectedRunId(saved.id);
            }
            if (!autoArm) {
              setIsArmed(false);
              globalDynoRecorder.disarm();
            }
          } catch (err) {
            console.error('Error finalizing dyno run:', err);
          } finally {
            isFinalizing.current = false;
          }
        })();
      }
    }
  }, [telemetry, isArmed, autoArm, mode, targetGear]);

  const toggleDynoArm = () => {
    if (isArmed) {
      globalDynoRecorder.disarm();
      setIsArmed(false);
      setDynoStage('DISARMED');
      setStatusDetail('DYNO DISARMED');
    } else {
      if (!telemetry) return;
      const car = getCarInfo(
        telemetry.car_ordinal,
        telemetry.car_class_name,
        telemetry.car_performance_index,
        telemetry.drivetrain_name
      );
      globalDynoRecorder.arm(mode, targetGear, {
        name: car.name,
        ordinal: telemetry.car_ordinal,
        class: car.class,
        pi: car.pi,
        drivetrain: car.drivetrain
      });
      setIsArmed(true);
      setDynoStage('ARMED');
    }
  };

  const handleDeleteRun = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this dyno run from local storage?')) {
      await deleteDynoRun(id);
      const remaining = dynoRuns.filter(r => r.id !== id);
      setDynoRuns(remaining);
      if (selectedRunId === id) {
        setSelectedRunId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  const activeRun = useMemo(() => {
    return dynoRuns.find(r => r.id === selectedRunId) || null;
  }, [dynoRuns, selectedRunId]);

  // Combine multi-gear curves into a unified speed-indexed series for charting
  const multiGearChartData = useMemo(() => {
    if (!activeRun || activeRun.mode !== 'multi_gear' || !activeRun.perGearCurves) return [];
    const speedMap: Record<number, Record<string, any>> = {};
    const gears = Object.keys(activeRun.perGearCurves).map(Number).sort((a, b) => a - b);
    
    for (const g of gears) {
      const points = activeRun.perGearCurves[g];
      for (const pt of points) {
        const roundedSpeed = Math.round(units.speed === 'mph' ? pt.speedMph : pt.speedKph);
        if (roundedSpeed <= 0) continue;
        if (!speedMap[roundedSpeed]) {
          speedMap[roundedSpeed] = { speed: roundedSpeed };
        }
        speedMap[roundedSpeed][`gear_${g}_hp`] = pt.hp;
        speedMap[roundedSpeed][`gear_${g}_tq`] = pt.torqueFtLb;
      }
    }
    
    return Object.keys(speedMap)
      .map(Number)
      .sort((a, b) => a - b)
      .map(spd => speedMap[spd]);
  }, [activeRun, units.speed]);

  const copyAiPrompt = async () => {
    if (!activeRun) return;
    const prompt = `### GridPulse Virtual Dyno Power & Gearing Analysis Request
**Vehicle**: ${activeRun.vehicle.name} (${activeRun.vehicle.class} ${activeRun.vehicle.pi} - ${activeRun.vehicle.drivetrain})
**Dyno Mode**: ${activeRun.mode === 'single_gear' ? `Single-Gear (Gear ${activeRun.targetGear})` : 'Multi-Gear Thrust Sweep'}
**Peak Horsepower**: ${activeRun.summary.peakHp} HP @ ${activeRun.summary.peakHpRpm} RPM
**Peak Torque**: ${activeRun.summary.peakTorqueFtLb} ft-lb @ ${activeRun.summary.peakTorqueRpm} RPM
**Usable Power Band (≥85% Peak)**: ${activeRun.summary.powerBandStartRpm} – ${activeRun.summary.powerBandEndRpm} RPM (Width: ${activeRun.summary.powerBandWidth} RPM)
**Optimal Upshift RPM**: ${activeRun.summary.optimalShiftRpm} RPM
**Observed Redline**: ${activeRun.summary.observedMaxRpm} RPM
**Peak Boost**: ${activeRun.summary.peakBoostPsi > 0 ? `${activeRun.summary.peakBoostPsi} PSI` : 'Naturally Aspirated'}

${activeRun.shiftPoints.length > 0 ? `**Gear Shift Recommendations**:\n${activeRun.shiftPoints.map(sp => `- Gear ${sp.fromGear} ➔ ${sp.toGear}: Shift @ ${sp.shiftSpeedMph} MPH (${sp.shiftRpm} RPM), landing at ${sp.dropRpm} RPM`).join('\n')}` : ''}

**Request**:
Please act as an expert race engine tuner and powertrain calibration engineer. Analyze this power curve and gearing profile, evaluate whether the transmission gear ratios optimize power band retention, and suggest 3 concrete setup modifications to improve acceleration and power delivery.`;

    const success = await copyTextToClipboard(prompt);
    if (success) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    }
  };

  return (
    <div className="p-2 sm:p-4 max-w-6xl mx-auto space-y-3 sm:space-y-4 pb-32 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Header Banner & Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#11111a] border border-white/10 rounded-2xl p-3 sm:p-4 min-w-0 w-full">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-xl font-black font-mono text-white tracking-wider flex items-center gap-2">
              <Zap size={18} className="text-emerald-400 shrink-0" />
              <span>VIRTUAL CHASSIS DYNO</span>
            </h1>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 shrink-0">
              AUTO-ARMING
            </span>
          </div>
          <p className="text-[11px] sm:text-xs font-mono text-gray-400 mt-1">
            Hands-free pull detection. Stage in gear, floor throttle to redline, and lift/brake to record.
          </p>
        </div>

        {/* Mode Toggle & Pull Trigger */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* Mode Pill */}
          <div className="grid grid-cols-2 gap-1 bg-black/60 p-1 rounded-xl border border-white/10 text-xs font-mono w-full sm:w-auto">
            <button
              onClick={() => setMode('single_gear')}
              className={`px-2 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-xs text-center ${
                mode === 'single_gear'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Single-Gear
            </button>
            <button
              onClick={() => setMode('multi_gear')}
              className={`px-2 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-xs text-center ${
                mode === 'multi_gear'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Multi-Gear
            </button>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-start">
            {/* Target Gear Selector (Single-Gear Mode) */}
            {mode === 'single_gear' && (
              <div className="flex items-center gap-1 bg-black/60 px-2 py-1.5 rounded-xl border border-white/10 text-xs font-mono shrink-0">
                <span className="text-gray-400 text-[10px] font-bold uppercase">GEAR:</span>
                <select
                  value={targetGear}
                  onChange={(e) => setTargetGear(parseInt(e.target.value, 10))}
                  className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
                >
                  <option value={3} className="bg-[#111118]">3rd</option>
                  <option value={4} className="bg-[#111118]">4th</option>
                  <option value={5} className="bg-[#111118]">5th</option>
                  <option value={6} className="bg-[#111118]">6th</option>
                </select>
              </div>
            )}

            {/* Auto-ReArm Toggle */}
            <button
              onClick={() => setAutoArm(!autoArm)}
              title={autoArm ? 'Auto-ReArm: Re-arms immediately after each dyno pull' : 'Single-Run Mode: Disarms after pull'}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border shrink-0 ${
                autoArm 
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                  : 'bg-black/60 border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <RotateCcw size={11} />
              <span className="text-[10px]">{autoArm ? 'RE-ARM: ON' : 'RE-ARM: OFF'}</span>
            </button>

            {/* Arm / Disarm Toggle Button */}
            <button
              onClick={toggleDynoArm}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-mono font-black tracking-wider transition-all cursor-pointer shadow-lg shrink-0 ${
                isArmed
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-white/10'
              }`}
            >
              <Zap size={13} className={isArmed ? 'fill-current' : ''} />
              <span>{isArmed ? 'ARMED' : 'DISARMED'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Auto-Arming Staging Banner */}
      <Card className="p-3 sm:p-4 bg-[#0e0e16] border-white/10 space-y-3 min-w-0 w-full overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-emerald-400 shrink-0" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              {isArmed ? 'Live Dyno Staging & Auto-Pull' : 'Dyno Standby'}
            </h3>
          </div>
          <button 
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-gray-500 hover:text-gray-300 text-xs font-mono flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle size={14} />
            <span>{showInstructions ? 'Hide Guide' : 'Guide'}</span>
          </button>
        </div>

        {/* Live Staging Assistant Bar */}
        {isArmed && (
          <div className="bg-black/60 border border-white/10 rounded-xl p-3 sm:p-4 space-y-3 min-w-0 w-full overflow-hidden">
            <div className="flex flex-col gap-2.5 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] sm:text-xs font-mono font-black px-2 py-0.5 rounded-lg shrink-0 ${
                  dynoStage === 'ARMED'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : dynoStage === 'TRIGGERING'
                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 animate-pulse'
                    : dynoStage === 'PULLING'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                }`}>
                  {dynoStage}
                </span>

                <span className="text-[11px] sm:text-xs font-mono text-gray-300 truncate">
                  {statusDetail}
                </span>
              </div>

              {/* Live Power Output */}
              <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-white/5 p-2 rounded-lg text-center">
                <div>
                  <span className="text-[8px] text-gray-500 uppercase block">LIVE POWER</span>
                  <span className="text-emerald-400 font-black text-xs sm:text-sm">{Math.round(liveHp)} HP</span>
                </div>
                <div>
                  <span className="text-[8px] text-gray-500 uppercase block">LIVE TORQUE</span>
                  <span className="text-amber-400 font-black text-xs sm:text-sm">{Math.round(liveTq)} ft-lb</span>
                </div>
                <div>
                  <span className="text-[8px] text-gray-500 uppercase block">LIVE RPM</span>
                  <span className="text-white font-black text-xs sm:text-sm">{telemetry?.current_engine_rpm ? Math.round(telemetry.current_engine_rpm) : 0}</span>
                </div>
              </div>
            </div>

            {/* Tachometer Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] sm:text-[10px] font-mono text-gray-400">
                <span>{telemetry?.engine_idle_rpm ? Math.round(telemetry.engine_idle_rpm) : 800} RPM</span>
                <span className="text-emerald-400 font-bold">{telemetry?.current_engine_rpm ? Math.round(telemetry.current_engine_rpm) : 0} RPM</span>
                <span className="text-red-400 font-bold">{telemetry?.engine_max_rpm ? Math.round(telemetry.engine_max_rpm) : 8500} MAX</span>
              </div>
              <div className="w-full h-2.5 sm:h-3 bg-black rounded-full overflow-hidden border border-white/10">
                <div 
                  className={`h-full transition-all duration-75 ${
                    stageProgress > 90 ? 'bg-red-500 animate-pulse' : stageProgress > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${stageProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {showInstructions && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
            <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-[9px]">1</span>
                <span>Select Target Gear</span>
              </div>
              <p className="text-gray-400 text-[10px] leading-relaxed">
                Use <strong>4th gear</strong> (5/6-speeds) or <strong>5th gear</strong> (7/8-speeds) for a 1.00:1 drive ratio without wheelspin.
              </p>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px]">
                <span className="w-4 h-4 rounded-full bg-cyan-500/20 flex items-center justify-center text-[9px]">2</span>
                <span>Stage at Low RPM</span>
              </div>
              <p className="text-gray-400 text-[10px] leading-relaxed">
                Find flat asphalt (Dragstrip or Highway). Cruise in target gear at <strong>2,000–2,500 RPM</strong>.
              </p>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[9px]">3</span>
                <span>Floor Throttle (WOT)</span>
              </div>
              <p className="text-gray-400 text-[10px] leading-relaxed">
                Floor the throttle (100%). The pull triggers automatically after 0.25s sustained WOT.
              </p>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
                <span className="w-4 h-4 rounded-full bg-rose-500/20 flex items-center justify-center text-[9px]">4</span>
                <span>Hold to Redline</span>
              </div>
              <p className="text-gray-400 text-[10px] leading-relaxed">
                Hold full throttle until the rev limiter. Lift off to automatically finish and plot the curves!
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Dyno Run History Reel */}
      {dynoRuns.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {dynoRuns.map((run) => {
            const isSelected = run.id === selectedRunId;
            return (
              <div
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 min-w-[220px] flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-400 shadow-md shadow-emerald-500/10'
                    : 'bg-[#0e0e16] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                    <Badge carClass={run.vehicle.class} className="text-[8px] px-1 py-0 shrink-0">
                      {run.vehicle.class} {run.vehicle.pi}
                    </Badge>
                    <span className="text-[10px] font-mono font-bold text-gray-300 truncate">
                      {run.vehicle.name}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteRun(run.id, e)}
                    className="text-gray-500 hover:text-red-400 p-0.5 cursor-pointer shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="my-1.5">
                  <div className="text-sm font-mono font-black text-emerald-400 flex items-center gap-2">
                    <span>{run.summary.peakHp} HP</span>
                    <span className="text-amber-400 text-xs font-normal">/ {run.summary.peakTorqueFtLb} ft-lb</span>
                  </div>
                  <div className="text-[9px] font-mono text-gray-400 flex items-center justify-between mt-0.5">
                    <span>{run.mode === 'single_gear' ? `Gear ${run.targetGear} Pull` : 'Multi-Gear'}</span>
                    <span>{new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono text-gray-400 pt-1 border-t border-white/5">
                  <span>@{run.summary.peakHpRpm} RPM</span>
                  <span className={run.quality === 'FULL' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {run.quality === 'FULL' ? 'FULL PULL' : 'PARTIAL'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="p-6 text-center bg-[#0e0e16] border-white/10 space-y-2">
          <Zap size={28} className="mx-auto text-gray-600" />
          <h3 className="text-sm font-mono font-bold text-gray-300">No Dyno Runs Saved Yet</h3>
          <p className="text-xs font-mono text-gray-500 max-w-md mx-auto">
            Click <strong className="text-emerald-400">START DYNO RUN</strong>, cruise in 4th gear, and floor the throttle to plot your car's power curve.
          </p>
        </Card>
      )}

      {/* Active Dyno Run Analysis */}
      {activeRun && (
        <div className="space-y-3 sm:space-y-4 min-w-0 w-full">
          {/* KPI Summary Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 min-w-0 w-full">
            <Card className="p-2.5 sm:p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-mono font-bold text-gray-500 uppercase truncate">VEHICLE</span>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                  activeRun.quality === 'FULL'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {activeRun.quality === 'FULL' ? 'FULL PULL' : 'PARTIAL PULL'}
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-white truncate mt-1">
                {activeRun.vehicle.name}
              </div>
              <div className="flex items-center gap-1 mt-1 truncate">
                <Badge carClass={activeRun.vehicle.class} className="text-[9px] shrink-0">
                  {activeRun.vehicle.class} {activeRun.vehicle.pi}
                </Badge>
                <span className="text-[9px] font-mono text-gray-400 truncate">
                  {activeRun.summary.observedMaxRpm} MAX RPM
                </span>
              </div>
            </Card>

            <Card className="p-2.5 sm:p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between min-w-0">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">PEAK POWER</span>
              <div className="text-sm sm:text-base font-mono font-black text-emerald-400 mt-1">
                {activeRun.summary.peakHp} <span className="text-[10px] text-gray-500 font-normal">HP</span>
              </div>
              <span className="text-[9px] font-mono text-gray-500 truncate">@{activeRun.summary.peakHpRpm} RPM</span>
            </Card>

            <Card className="p-2.5 sm:p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between min-w-0">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">PEAK TORQUE</span>
              <div className="text-sm sm:text-base font-mono font-black text-amber-400 mt-1">
                {activeRun.summary.peakTorqueFtLb} <span className="text-[10px] text-gray-500 font-normal">ft-lb</span>
              </div>
              <span className="text-[9px] font-mono text-gray-500 truncate">@{activeRun.summary.peakTorqueRpm} RPM</span>
            </Card>

            <Card className="p-2.5 sm:p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between min-w-0">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">85% POWER BAND</span>
              <div className="text-xs sm:text-sm font-mono font-black text-cyan-400 mt-1">
                {activeRun.summary.powerBandStartRpm}–{activeRun.summary.powerBandEndRpm}
              </div>
              <span className="text-[9px] font-mono text-gray-500 truncate">Width: {activeRun.summary.powerBandWidth} RPM</span>
            </Card>

            <Card className="p-2.5 sm:p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between min-w-0">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">OPTIMAL SHIFT</span>
              <div className="text-sm sm:text-base font-mono font-black text-rose-400 mt-1">
                {activeRun.summary.optimalShiftRpm} <span className="text-[10px] text-gray-500 font-normal">RPM</span>
              </div>
              <span className="text-[9px] font-mono text-gray-500 truncate">
                {activeRun.summary.peakBoostPsi > 0 
                  ? `Peak Boost: ${convertPressure(activeRun.summary.peakBoostPsi).value} ${convertPressure(activeRun.summary.peakBoostPsi).label}` 
                  : 'Naturally Aspirated'}
              </span>
            </Card>

            {/* AI Prompt & Export Actions */}
            <Card className="p-2.5 bg-gradient-to-br from-[#121220] to-[#0c0c14] border-white/10 flex flex-col justify-between gap-1.5 min-w-0">
              <button
                onClick={copyAiPrompt}
                className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold transition-all cursor-pointer"
              >
                {copiedPrompt ? <Check size={12} className="text-emerald-400" /> : <Sparkles size={12} />}
                <span className="truncate">{copiedPrompt ? 'Copied Dyno Prompt' : 'AI Tuning Coach'}</span>
              </button>

              <button
                onClick={() => downloadDynoJsonFile(activeRun)}
                className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold transition-all cursor-pointer"
              >
                <Download size={12} />
                <span className="truncate">Export Dyno JSON</span>
              </button>
            </Card>
          </div>

          {/* Dyno Graph 1: Classic Single-Gear Dyno Chart (HP & Torque vs RPM) */}
          <Card className="p-3 sm:p-4 bg-[#0e0e16] border-white/10 space-y-3 min-w-0 overflow-hidden w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-amber-400 shrink-0" />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Chassis Dyno Power Curve (HP &amp; Torque vs RPM)
                </h3>
              </div>
              <div className="flex items-center gap-2.5 text-[10px] font-mono font-bold flex-wrap">
                <span className="text-emerald-400">● HP</span>
                <span className="text-amber-400">● Torque (ft-lb)</span>
                {activeRun.summary.peakBoostPsi > 0 && (
                  <span className="text-cyan-400">● Boost ({units.pressure.toUpperCase()})</span>
                )}
              </div>
            </div>

            <div className="h-60 sm:h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart data={activeRun.rpmCurve} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="rpm" stroke="#6b7280" fontSize={10} tickFormatter={(v) => `${v}`} />
                  <YAxis yAxisId="power" stroke="#10b981" fontSize={10} domain={[0, 'auto']} />
                  {activeRun.summary.peakBoostPsi > 0 && (
                    <YAxis yAxisId="boost" orientation="right" stroke="#06b6d4" fontSize={10} domain={[0, 'auto']} />
                  )}
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a10', borderColor: '#ffffff20', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} 
                  />
                  {/* 5,252 RPM Crossover Reference Line */}
                  <ReferenceLine yAxisId="power" x={5252} stroke="#ffffff40" strokeDasharray="3 3" label={{ value: '5252 RPM', fill: '#9ca3af', fontSize: 10, position: 'insideTopLeft' }} />
                  <Line yAxisId="power" type="monotone" dataKey="hp" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive={false} name="Horsepower (HP)" />
                  <Line yAxisId="power" type="monotone" dataKey="torqueFtLb" stroke="#f59e0b" strokeWidth={2.5} dot={false} isAnimationActive={false} name="Torque (ft-lb)" />
                  {activeRun.summary.peakBoostPsi > 0 && (
                    <Line yAxisId="boost" type="monotone" dataKey="boostPsi" stroke="#06b6d4" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Boost (PSI)" strokeDasharray="2 2" />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Dyno Graph 2 & Gearing Optimizer: Multi-Gear Thrust & Shift Points */}
          {activeRun.mode === 'multi_gear' && Object.keys(activeRun.perGearCurves).length > 1 && (
            <Card className="p-3 sm:p-4 bg-[#0e0e16] border-white/10 space-y-3 min-w-0 overflow-hidden w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <Gauge size={16} className="text-cyan-400 shrink-0" />
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Multi-Gear Thrust Curves &amp; Upshift Points (vs Speed)
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono font-bold flex-wrap">
                  {Object.keys(activeRun.perGearCurves).map((g) => (
                    <span key={g} style={{ color: GEAR_COLORS[(parseInt(g, 10) - 1) % GEAR_COLORS.length] }}>
                      ● Gear {g} Power
                    </span>
                  ))}
                </div>
              </div>

              {/* Multi-Gear Speed Chart */}
              {multiGearChartData.length > 0 && (
                <div className="h-60 sm:h-72 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <ComposedChart data={multiGearChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="speed" stroke="#6b7280" fontSize={10} unit={` ${units.speed.toUpperCase()}`} />
                      <YAxis stroke="#10b981" fontSize={10} domain={[0, 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0a0a10', borderColor: '#ffffff20', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} />
                      {Object.keys(activeRun.perGearCurves).map(Number).sort((a, b) => a - b).map((g) => (
                        <Line
                          key={`gear_${g}`}
                          type="monotone"
                          dataKey={`gear_${g}_hp`}
                          stroke={GEAR_COLORS[(g - 1) % GEAR_COLORS.length]}
                          strokeWidth={2.5}
                          dot={false}
                          isAnimationActive={false}
                          name={`Gear ${g} Power (HP)`}
                          connectNulls={true}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Shift Points Recommendation Table */}
              {activeRun.shiftPoints.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-white/5">
                  <div className="text-[10px] font-mono font-bold text-gray-400 uppercase">Recommended Shift Windows</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {activeRun.shiftPoints.map((sp, idx) => (
                      <div key={idx} className="bg-black/40 border border-white/5 rounded-lg p-2.5 text-xs font-mono space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            Gear {sp.fromGear} <ArrowRight size={12} /> Gear {sp.toGear}
                          </span>
                          <span className="text-white font-black">{sp.shiftSpeedMph} MPH</span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Shift @ <strong className="text-rose-400">{sp.shiftRpm} RPM</strong> ➔ Lands at <strong className="text-cyan-300">{sp.dropRpm} RPM</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* AI Dyno Tuning Coach Card */}
          <Card className="p-3 sm:p-5 bg-gradient-to-br from-[#121222] via-[#0e0e18] to-[#0a0a10] border-emerald-500/30 space-y-4 min-w-0 overflow-hidden w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-mono font-black text-white uppercase tracking-wider flex items-center gap-2">
                    AI Powertrain &amp; Gearing Tuning Coach
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                      AUTOMATED ANALYSIS
                    </span>
                  </h3>
                  <p className="text-[11px] font-mono text-gray-400">
                    Physics-based diagnosis of power delivery, torque plateau, and transmission gear ratio spacing.
                  </p>
                </div>
              </div>

              <button
                onClick={copyAiPrompt}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-black text-xs uppercase tracking-wider transition-all transform active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(0,255,136,0.25)] shrink-0"
              >
                {copiedPrompt ? <Check size={14} className="text-black" /> : <Cpu size={14} />}
                <span>{copiedPrompt ? 'Copied to Clipboard!' : 'Copy Full AI Tuning Prompt'}</span>
              </button>
            </div>

            {/* Diagnostics Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
              {/* 1. Power Band Retention */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Flame size={15} />
                  <span className="font-bold uppercase tracking-wider">Power Band Retention</span>
                </div>
                <div className="text-[11px] text-gray-300 space-y-1">
                  <p>
                    Usable power band is <strong className="text-white">{activeRun.summary.powerBandStartRpm}–{activeRun.summary.powerBandEndRpm} RPM</strong> (Width: {activeRun.summary.powerBandWidth} RPM).
                  </p>
                  {activeRun.summary.peakHpRpm < activeRun.summary.maxRpm * 0.88 ? (
                    <p className="text-amber-400 text-[10px]">
                      ⚠️ Power peaks early ({activeRun.summary.peakHpRpm} RPM vs {activeRun.summary.maxRpm} Redline). Recommend short-shifting at {activeRun.summary.optimalShiftRpm} RPM or installing Race Camshaft/Turbo to sustain top-end power.
                    </p>
                  ) : (
                    <p className="text-emerald-400 text-[10px]">
                      ✓ High-revving power delivery: Peak power holds deep into the rev range. Full throttle up to {activeRun.summary.optimalShiftRpm} RPM.
                    </p>
                  )}
                </div>
              </div>

              {/* 2. Transmission & Gearing Spacing */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Sliders size={15} />
                  <span className="font-bold uppercase tracking-wider">Gear Ratio Spacing</span>
                </div>
                <div className="text-[11px] text-gray-300 space-y-1">
                  {activeRun.shiftPoints.length > 0 ? (
                    <div>
                      <p>
                        Estimated {activeRun.shiftPoints.length} upshift points analyzed.
                      </p>
                      {activeRun.shiftPoints.some(sp => sp.dropRpm < activeRun.summary.powerBandStartRpm) ? (
                        <p className="text-amber-400 text-[10px]">
                          ⚠️ Gear ratio gap detected: Upshift drops RPM below the {activeRun.summary.powerBandStartRpm} RPM threshold. Shorten intermediate gears (increase ratio by +0.10 to +0.20) to stay on boost.
                        </p>
                      ) : (
                        <p className="text-cyan-300 text-[10px]">
                          ✓ Tight gear spacing: All upshifts land securely inside the {activeRun.summary.powerBandStartRpm}–{activeRun.summary.powerBandEndRpm} RPM optimal thrust window.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-[10px]">
                      Perform a Multi-Gear pull through gears 1➔6 to generate full transmission ratio drop analysis.
                    </p>
                  )}
                </div>
              </div>

              {/* 3. Powertrain & Traction Calibration */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-pink-400">
                  <Zap size={15} />
                  <span className="font-bold uppercase tracking-wider">Traction &amp; Differential</span>
                </div>
                <div className="text-[11px] text-gray-300 space-y-1">
                  <p>
                    Torque: <strong className="text-white">{activeRun.summary.peakTorqueFtLb} ft-lb</strong> @ {activeRun.summary.peakTorqueRpm} RPM ({activeRun.vehicle.drivetrain}).
                  </p>
                  {activeRun.vehicle.drivetrain === 'RWD' && activeRun.summary.peakTorqueFtLb > 450 ? (
                    <p className="text-pink-300 text-[10px]">
                      💡 High low-end torque on RWD chassis: Lengthen 1st and 2nd gear ratios (lower ratio) or soften rear Anti-Roll Bar to prevent wheelspin on corner exit.
                    </p>
                  ) : (
                    <p className="text-gray-400 text-[10px]">
                      Linear torque delivery. Maintain standard differential acceleration lock for balanced traction.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
