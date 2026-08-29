import { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useTelemetry } from '../hooks/useTelemetry';
import { getCarInfo } from '../lib/cars';
import { 
  getAllDynoRuns, 
  deleteDynoRun, 
  downloadDynoJsonFile, 
  globalDynoRecorder, 
  type DynoRun, 
  type DynoStage 
} from '../lib/dyno';
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
  Play, 
  Square, 
  Check, 
  Sparkles, 
  Gauge, 
  Flame, 
  ArrowRight,
  HelpCircle
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

  const [dynoRuns, setDynoRuns] = useState<DynoRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [mode, setMode] = useState<'single_gear' | 'multi_gear'>('single_gear');
  const [targetGear, setTargetGear] = useState<number>(4);
  const [isRecording, setIsRecording] = useState(false);
  const [dynoStage, setDynoStage] = useState<DynoStage>('IDLE');
  const [stageProgress, setStageProgress] = useState(0);
  const [liveHp, setLiveHp] = useState(0);
  const [liveTq, setLiveTq] = useState(0);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

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

  // Process live telemetry frame into Dyno Recorder
  useEffect(() => {
    if (isRecording && telemetry) {
      const res = globalDynoRecorder.processFrame(telemetry);
      setDynoStage(res.stage);
      setStageProgress(res.progressPct);
      setLiveHp(res.currentHp);
      setLiveTq(res.currentTq);

      // Auto-finish if cooldown completed
      if (res.stage === 'COOLDOWN' && globalDynoRecorder.getSampleCount() > 30) {
        // Auto-stop after brief cooldown buffer
        const timer = setTimeout(async () => {
          if (globalDynoRecorder.getIsRecording()) {
            const saved = await globalDynoRecorder.stop();
            setIsRecording(false);
            setDynoStage('COMPLETED');
            await refreshRuns();
            if (saved) setSelectedRunId(saved.id);
          }
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [telemetry, isRecording]);

  const toggleDynoRun = async () => {
    if (isRecording) {
      const saved = await globalDynoRecorder.stop();
      setIsRecording(false);
      setDynoStage('COMPLETED');
      await refreshRuns();
      if (saved) setSelectedRunId(saved.id);
    } else {
      if (!telemetry) return;
      const car = getCarInfo(
        telemetry.car_ordinal,
        telemetry.car_class_name,
        telemetry.car_performance_index,
        telemetry.drivetrain_name
      );
      globalDynoRecorder.start(
        mode,
        targetGear,
        {
          name: car.name,
          ordinal: telemetry.car_ordinal,
          class: car.class,
          pi: car.pi,
          drivetrain: car.drivetrain
        }
      );
      setIsRecording(true);
      setDynoStage('STAGING');
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

  const copyAiPrompt = () => {
    if (!activeRun) return;
    const prompt = `### GridPulse Virtual Dyno Power & Gearing Analysis Request
**Vehicle**: ${activeRun.vehicle.name} (${activeRun.vehicle.class} ${activeRun.vehicle.pi} - ${activeRun.vehicle.drivetrain})
**Dyno Mode**: ${activeRun.mode === 'single_gear' ? `Single-Gear (Gear ${activeRun.targetGear})` : 'Multi-Gear Thrust Sweep'}
**Peak Horsepower**: ${activeRun.summary.peakHp} HP @ ${activeRun.summary.peakHpRpm} RPM
**Peak Torque**: ${activeRun.summary.peakTorqueFtLb} ft-lb @ ${activeRun.summary.peakTorqueRpm} RPM
**Usable Power Band (≥85% Peak)**: ${activeRun.summary.powerBandStartRpm} – ${activeRun.summary.powerBandEndRpm} RPM (Width: ${activeRun.summary.powerBandWidth} RPM)
**Optimal Upshift RPM**: ${activeRun.summary.optimalShiftRpm} RPM
**Peak Boost**: ${activeRun.summary.peakBoostPsi > 0 ? `${activeRun.summary.peakBoostPsi} PSI` : 'Naturally Aspirated'}

${activeRun.shiftPoints.length > 0 ? `**Gear Shift Recommendations**:\n${activeRun.shiftPoints.map(sp => `- Gear ${sp.fromGear} ➔ ${sp.toGear}: Shift @ ${sp.shiftSpeedMph} MPH (${sp.shiftRpm} RPM), landing at ${sp.dropRpm} RPM`).join('\n')}` : ''}

**Request**:
Please act as an expert race engine tuner and powertrain calibration engineer. Analyze this power curve and gearing profile, evaluate whether the transmission gear ratios optimize power band retention, and suggest 3 concrete setup modifications to improve acceleration and power delivery.`;

    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  return (
    <div className="p-3 sm:p-4 max-w-6xl mx-auto space-y-4 pb-32">
      {/* Header Banner & Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#11111a] border border-white/10 rounded-2xl p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black font-mono text-white tracking-wider flex items-center gap-2">
              <Zap size={20} className="text-emerald-400" />
              VIRTUAL CHASSIS DYNO &amp; POWER LAB
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              PHYSICS ACCURATE
            </span>
          </div>
          <p className="text-xs font-mono text-gray-400 mt-1">
            Capture wide-open-throttle power &amp; torque curves, find peak RPM thresholds, and optimize transmission shift points.
          </p>
        </div>

        {/* Mode Toggle & Pull Trigger */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Pill */}
          <div className="flex bg-black/60 p-1 rounded-xl border border-white/10 text-xs font-mono">
            <button
              onClick={() => setMode('single_gear')}
              disabled={isRecording}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                mode === 'single_gear'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Single-Gear (RPM)
            </button>
            <button
              onClick={() => setMode('multi_gear')}
              disabled={isRecording}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                mode === 'multi_gear'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Multi-Gear (Speed)
            </button>
          </div>

          {/* Target Gear Selector (Single-Gear Mode) */}
          {mode === 'single_gear' && (
            <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded-xl border border-white/10 text-xs font-mono">
              <span className="text-gray-400 text-[10px] font-bold uppercase">GEAR:</span>
              <select
                value={targetGear}
                onChange={(e) => setTargetGear(parseInt(e.target.value, 10))}
                disabled={isRecording}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              >
                <option value={3} className="bg-[#111118]">3rd Gear</option>
                <option value={4} className="bg-[#111118]">4th Gear (Rec)</option>
                <option value={5} className="bg-[#111118]">5th Gear (Rec)</option>
                <option value={6} className="bg-[#111118]">6th Gear</option>
              </select>
            </div>
          )}

          {/* Record / Stop Button */}
          <button
            onClick={toggleDynoRun}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-black tracking-wider transition-all cursor-pointer shadow-lg ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-red-500/30'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
            }`}
          >
            {isRecording ? (
              <>
                <Square size={14} className="fill-current" />
                <span>STOP DYNO</span>
              </>
            ) : (
              <>
                <Play size={14} className="fill-current" />
                <span>START DYNO RUN</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step-by-Step In-App Pull Assistant (Active when Recording or Helper expanded) */}
      <Card className="p-4 bg-[#0e0e16] border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-emerald-400" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              {isRecording ? 'Live Dyno Staging Assistant' : 'How to Perform a Precision Dyno Pull'}
            </h3>
          </div>
          <button 
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-gray-500 hover:text-gray-300 text-xs font-mono flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle size={14} />
            <span>{showInstructions ? 'Hide Guide' : 'Show Guide'}</span>
          </button>
        </div>

        {/* Live Staging Assistant Bar */}
        {isRecording ? (
          <div className="bg-black/60 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg ${
                  dynoStage === 'STAGING'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : dynoStage === 'PULLING'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                }`}>
                  STAGE: {dynoStage}
                </span>

                <span className="text-xs font-mono text-gray-300">
                  {dynoStage === 'STAGING' && (
                    mode === 'single_gear'
                      ? `Shift to Gear ${targetGear} and cruise steadily at ~2,000–2,500 RPM on flat road.`
                      : 'Cruise at low speed in 1st/2nd gear on flat road.'
                  )}
                  {dynoStage === 'PULLING' && '🔥 FLOOR THROTTLE (100% WOT) ALL THE WAY TO REDLINE!'}
                  {dynoStage === 'COOLDOWN' && '✅ Redline reached! Lift off throttle to finish...'}
                </span>
              </div>

              {/* Live Power Output */}
              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-[9px] text-gray-500 uppercase block">LIVE POWER</span>
                  <span className="text-emerald-400 font-black">{Math.round(liveHp)} HP</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-500 uppercase block">LIVE TORQUE</span>
                  <span className="text-amber-400 font-black">{Math.round(liveTq)} ft-lb</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-500 uppercase block">RPM</span>
                  <span className="text-white font-black">{telemetry?.current_engine_rpm ? Math.round(telemetry.current_engine_rpm) : 0}</span>
                </div>
              </div>
            </div>

            {/* Tachometer Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-gray-400">
                <span>800 RPM</span>
                <span className="text-emerald-400 font-bold">{telemetry?.current_engine_rpm ? Math.round(telemetry.current_engine_rpm) : 0} RPM</span>
                <span className="text-red-400 font-bold">{telemetry?.engine_max_rpm ? Math.round(telemetry.engine_max_rpm) : 8000} REDLINE</span>
              </div>
              <div className="w-full h-3 bg-black rounded-full overflow-hidden border border-white/10">
                <div 
                  className={`h-full transition-all duration-75 ${
                    stageProgress > 90 ? 'bg-red-500 animate-pulse' : stageProgress > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${stageProgress}%` }}
                />
              </div>
            </div>
          </div>
        ) : showInstructions && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">1</span>
                <span>Select Target Gear</span>
              </div>
              <p className="text-gray-400 text-[10px] leading-relaxed">
                Use <strong>4th gear</strong> (5/6-speeds) or <strong>5th gear</strong> (7/8-speeds) for a 1.00:1 drive ratio without wheelspin.
              </p>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px]">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px]">2</span>
                <span>Stage at Low RPM</span>
              </div>
              <p className="text-gray-400 text-[10px] leading-relaxed">
                Find flat asphalt (Horizon Festival Dragstrip or Highway). Cruise in target gear at <strong>2,000–2,500 RPM</strong>.
              </p>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">3</span>
                <span>Floor Throttle (WOT)</span>
              </div>
              <p className="text-gray-400 text-[10px] leading-relaxed">
                Press <strong>START DYNO RUN</strong> and floor the throttle (100%). The pull triggers automatically.
              </p>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center text-[10px]">4</span>
                <span>Hold to Redline</span>
              </div>
              <p className="text-gray-400 text-[10px] leading-relaxed">
                Hold full throttle until you hit the rev limiter. Lift off to automatically finish and plot the curves!
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
                className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 min-w-[210px] flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-400 shadow-md shadow-emerald-500/10'
                    : 'bg-[#0e0e16] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-mono font-bold text-gray-400 truncate max-w-[140px]">
                    {run.vehicle.name}
                  </span>
                  <button
                    onClick={(e) => handleDeleteRun(run.id, e)}
                    className="text-gray-500 hover:text-red-400 p-0.5 cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="my-1">
                  <div className="text-sm font-mono font-black text-emerald-400 flex items-center gap-2">
                    <span>{run.summary.peakHp} HP</span>
                    <span className="text-amber-400 text-xs font-normal">/ {run.summary.peakTorqueFtLb} ft-lb</span>
                  </div>
                  <div className="text-[9px] font-mono text-gray-500">
                    {run.mode === 'single_gear' ? `Gear ${run.targetGear} Pull` : 'Multi-Gear Sprint'} • {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono text-gray-400 pt-1 border-t border-white/5">
                  <span>@{run.summary.peakHpRpm} RPM</span>
                  <span className="text-cyan-400">{run.summary.powerBandWidth} RPM Band</span>
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
        <div className="space-y-4">
          {/* KPI Summary Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            <Card className="p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">VEHICLE</span>
              <div className="text-xs font-mono font-bold text-white truncate mt-1">
                {activeRun.vehicle.name}
              </div>
              <Badge carClass={activeRun.vehicle.class} className="text-[9px] self-start mt-1">
                {activeRun.vehicle.class} {activeRun.vehicle.pi}
              </Badge>
            </Card>

            <Card className="p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">PEAK POWER</span>
              <div className="text-sm sm:text-base font-mono font-black text-emerald-400 mt-1">
                {activeRun.summary.peakHp} <span className="text-[10px] text-gray-500 font-normal">HP</span>
              </div>
              <span className="text-[9px] font-mono text-gray-500">@{activeRun.summary.peakHpRpm} RPM</span>
            </Card>

            <Card className="p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">PEAK TORQUE</span>
              <div className="text-sm sm:text-base font-mono font-black text-amber-400 mt-1">
                {activeRun.summary.peakTorqueFtLb} <span className="text-[10px] text-gray-500 font-normal">ft-lb</span>
              </div>
              <span className="text-[9px] font-mono text-gray-500">@{activeRun.summary.peakTorqueRpm} RPM</span>
            </Card>

            <Card className="p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">85% POWER BAND</span>
              <div className="text-xs sm:text-sm font-mono font-black text-cyan-400 mt-1">
                {activeRun.summary.powerBandStartRpm}–{activeRun.summary.powerBandEndRpm}
              </div>
              <span className="text-[9px] font-mono text-gray-500">Width: {activeRun.summary.powerBandWidth} RPM</span>
            </Card>

            <Card className="p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">OPTIMAL SHIFT</span>
              <div className="text-sm sm:text-base font-mono font-black text-rose-400 mt-1">
                {activeRun.summary.optimalShiftRpm} <span className="text-[10px] text-gray-500 font-normal">RPM</span>
              </div>
              <span className="text-[9px] font-mono text-gray-500">
                {activeRun.summary.peakBoostPsi > 0 ? `Peak Boost: ${activeRun.summary.peakBoostPsi} PSI` : 'Naturally Aspirated'}
              </span>
            </Card>

            {/* AI Prompt & Export Actions */}
            <Card className="p-2.5 bg-gradient-to-br from-[#121220] to-[#0c0c14] border-white/10 flex flex-col justify-between gap-1.5">
              <button
                onClick={copyAiPrompt}
                className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold transition-all cursor-pointer"
              >
                {copiedPrompt ? <Check size={12} className="text-emerald-400" /> : <Sparkles size={12} />}
                <span>{copiedPrompt ? 'Copied Dyno Prompt' : 'AI Tuning Coach'}</span>
              </button>

              <button
                onClick={() => downloadDynoJsonFile(activeRun)}
                className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold transition-all cursor-pointer"
              >
                <Download size={12} />
                <span>Export Dyno JSON</span>
              </button>
            </Card>
          </div>

          {/* Dyno Graph 1: Classic Single-Gear Dyno Chart (HP & Torque vs RPM) */}
          <Card className="p-4 bg-[#0e0e16] border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-amber-400" />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Chassis Dyno Power Curve (HP &amp; Torque vs RPM)
                </h3>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono font-bold">
                <span className="text-emerald-400">● Horsepower (HP)</span>
                <span className="text-amber-400">● Torque (ft-lb)</span>
                {activeRun.summary.peakBoostPsi > 0 && <span className="text-cyan-400">● Boost (PSI)</span>}
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={activeRun.rpmCurve}>
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
                  <ReferenceLine yAxisId="power" x={5252} stroke="#ffffff40" strokeDasharray="3 3" label={{ value: '5252 RPM (HP=TQ)', fill: '#9ca3af', fontSize: 10, position: 'insideTopLeft' }} />
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
            <Card className="p-4 bg-[#0e0e16] border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge size={16} className="text-cyan-400" />
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Multi-Gear Thrust Curves &amp; Upshift Points (vs Speed)
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono font-bold">
                  {Object.keys(activeRun.perGearCurves).map((g) => (
                    <span key={g} style={{ color: GEAR_COLORS[(parseInt(g, 10) - 1) % GEAR_COLORS.length] }}>
                      Gear {g}
                    </span>
                  ))}
                </div>
              </div>

              {/* Shift Points Recommendation Table */}
              {activeRun.shiftPoints.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 pb-2">
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
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
