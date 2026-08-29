import { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useTelemetry } from '../hooks/useTelemetry';
import { getCarInfo } from '../lib/cars';
import { useUnits } from '../context/UnitContext';
import { 
  getAllStints, 
  deleteStint, 
  downloadStintJsonFile, 
  importStintFromJson,
  globalStintRecorder, 
  type Stint,
  type SessionMode
} from '../lib/stints';
import { copyTextToClipboard } from '../lib/clipboard';
import { 
  ComposedChart,
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  ReferenceLine,
  Area
} from 'recharts';
import { 
  Activity, 
  Download, 
  Upload, 
  Trash2, 
  Play, 
  Square, 
  Check, 
  Sparkles, 
  Gauge, 
  Compass, 
  Flame, 
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';

export function RaceAnalyzePage() {
  const { telemetry } = useTelemetry();
  const { convertTemp } = useUnits();

  const [stints, setStints] = useState<Stint[]>([]);
  const [selectedStintId, setSelectedStintId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [preferredMode, setPreferredMode] = useState<SessionMode | 'AUTO'>('AUTO');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Stints from IndexedDB on mount
  const refreshStints = async () => {
    try {
      const list = await getAllStints();
      setStints(list);
      if (list.length > 0 && !selectedStintId) {
        setSelectedStintId(list[0].id);
      }
    } catch (e) {
      console.error('Failed to load stints from IndexedDB:', e);
    }
  };

  useEffect(() => {
    refreshStints();
  }, []);

  // Update active recording frame
  useEffect(() => {
    if (isRecording && telemetry) {
      globalStintRecorder.processFrame(telemetry);
    }
  }, [telemetry, isRecording]);

  // Recording timer interval
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordSeconds(Math.round(globalStintRecorder.getActiveDuration()));
      }, 500);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const toggleRecording = async () => {
    if (isRecording) {
      const saved = await globalStintRecorder.stop();
      setIsRecording(false);
      await refreshStints();
      if (saved) setSelectedStintId(saved.id);
    } else {
      if (!telemetry) return;
      const car = getCarInfo(
        telemetry.car_ordinal,
        telemetry.car_class_name,
        telemetry.car_performance_index,
        telemetry.drivetrain_name
      );
      globalStintRecorder.start(
        {
          name: car.name,
          ordinal: telemetry.car_ordinal,
          class: car.class,
          pi: car.pi,
          drivetrain: car.drivetrain
        },
        telemetry.distance_traveled || 0,
        preferredMode === 'AUTO' ? null : preferredMode
      );
      setIsRecording(true);
    }
  };

  const handleDeleteStint = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this telemetry stint from local storage?')) {
      await deleteStint(id);
      const remaining = stints.filter(s => s.id !== id);
      setStints(remaining);
      if (selectedStintId === id) {
        setSelectedStintId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const imported = await importStintFromJson(text);
        await refreshStints();
        setSelectedStintId(imported.id);
      } catch (err) {
        alert('Failed to import stint JSON file: ' + err);
      }
    };
    reader.readAsText(file);
  };

  const activeStint = useMemo(() => {
    return stints.find(s => s.id === selectedStintId) || null;
  }, [stints, selectedStintId]);

  // Downsample active stint samples for charts (up to 300 points for crisp UI performance)
  const chartData = useMemo(() => {
    if (!activeStint || !activeStint.samples) return [];
    const raw = activeStint.samples;
    if (raw.length <= 300) return raw;
    const step = Math.ceil(raw.length / 300);
    return raw.filter((_, i) => i % step === 0);
  }, [activeStint]);

  const copyAiPrompt = async () => {
    if (!activeStint) return;
    const prompt = `### GridPulse Telemetry Stint Analysis Request
**Vehicle**: ${activeStint.carName} (${activeStint.carClass} ${activeStint.carPi} - ${activeStint.drivetrain})
**Session Mode**: ${activeStint.sessionMode || 'FREE_ROAM'}
**Stint Duration**: ${activeStint.totalDurationSeconds}s | **Distance**: ${activeStint.totalDistanceMiles} miles | **Laps**: ${activeStint.totalLaps}
**Best Lap**: ${activeStint.bestLapTime > 0 ? `${activeStint.bestLapTime.toFixed(3)}s` : 'N/A'}
**Top Speed**: ${activeStint.topSpeedMph} MPH | **Peak Lateral G**: ${activeStint.peakLatG} G | **Peak Tire Temp**: ${activeStint.peakTireTemp}°F
${activeStint.driftSummary ? `**Drift Profile**: Max Angle: ${activeStint.driftSummary.maxAngleDeg}° (${activeStint.driftSummary.maxAngleRad} rad) | Slide Time: ${activeStint.driftSummary.timeInSlideSec}s (${activeStint.driftSummary.slidePct}%) | Transitions: ${activeStint.driftSummary.transitionCount} | Rear Temp Rise: ${activeStint.driftSummary.rearTempRiseRate}°F/s` : ''}
${activeStint.impacts && activeStint.impacts.length > 0 ? `**Wall / Barrier Impacts**: ${activeStint.impacts.length} detected (Peak Impact: ${Math.max(...activeStint.impacts.map(i => i.impactG))}G)` : '**Impacts**: 0 wall strikes'}

**Observed Driving Events**:
${activeStint.events.length > 0 ? activeStint.events.map(ev => `- [Lap ${ev.lapNumber} @ ${ev.timestamp}s] ${ev.type}: ${ev.description} (Severity: ${Math.round(ev.severity * 100)}%)`).join('\n') : '- Zero critical instability events detected.'}

**Request**:
Please act as an expert race engineer and driver coach. Analyze this ${activeStint.sessionMode.toLowerCase()} stint summary, identify driving technique flaws or setup bottlenecks, and provide 3 concrete actionable improvements.`;

    const ok = await copyTextToClipboard(prompt);
    if (ok) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    }
  };

  const formatLapTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '--:--.---';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds * 1000) % 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  return (
    <div className="p-3 sm:p-4 max-w-6xl mx-auto space-y-4 pb-32">
      {/* Header Banner & Live Stint Recorder Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#11111a] border border-white/10 rounded-2xl p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black font-mono text-white tracking-wider flex items-center gap-2">
              <Activity size={20} className="text-cyan-400" />
              RACE ANALYZE &amp; TELEMETRY LAB
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              SESSION INTELLIGENCE
            </span>
          </div>
          <p className="text-xs font-mono text-gray-400 mt-1">
            Analyze recorded driving stints, multi-lap overlays, wall impacts, drift angles, and export AI-ready datasets.
          </p>
        </div>

        {/* Action Controls: Mode Selector, Import & Recorder */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Override Dropdown */}
          <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded-xl border border-white/10 text-xs font-mono">
            <span className="text-gray-400 text-[10px] font-bold uppercase">MODE:</span>
            <select
              value={preferredMode}
              onChange={(e) => setPreferredMode(e.target.value as any)}
              disabled={isRecording}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              <option value="AUTO" className="bg-[#111118]">⚡ Auto-Detect</option>
              <option value="DRIFT" className="bg-[#111118]">💨 Drift</option>
              <option value="TIME_ATTACK" className="bg-[#111118]">⏱ Time Attack</option>
              <option value="CIRCUIT" className="bg-[#111118]">🏁 Circuit</option>
              <option value="SPRINT" className="bg-[#111118]">🚀 Sprint / Drag</option>
              <option value="OFFROAD" className="bg-[#111118]">🏔 Off-Road</option>
              <option value="FREE_ROAM" className="bg-[#111118]">🚗 Free Roam</option>
            </select>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-mono font-bold transition-all cursor-pointer"
          >
            <Upload size={14} />
            <span>Import</span>
          </button>

          <button
            onClick={toggleRecording}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-black tracking-wider transition-all cursor-pointer shadow-lg ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-red-500/30'
                : 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20'
            }`}
          >
            {isRecording ? (
              <>
                <Square size={14} className="fill-current" />
                <span>STOP ({recordSeconds}s)</span>
              </>
            ) : (
              <>
                <Play size={14} className="fill-current" />
                <span>RECORD STINT</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stint History Reel */}
      {stints.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {stints.map((stint) => {
            const isSelected = stint.id === selectedStintId;
            return (
              <div
                key={stint.id}
                onClick={() => setSelectedStintId(stint.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 min-w-[210px] flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/10'
                    : 'bg-[#0e0e16] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[10px] font-mono font-bold text-gray-300 truncate max-w-[110px]">
                      {stint.carName}
                    </span>
                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      stint.sessionMode === 'DRIFT' ? 'bg-amber-500/20 text-amber-300' :
                      stint.sessionMode === 'CIRCUIT' ? 'bg-purple-500/20 text-purple-300' :
                      stint.sessionMode === 'TIME_ATTACK' ? 'bg-emerald-500/20 text-emerald-300' :
                      stint.sessionMode === 'OFFROAD' ? 'bg-orange-500/20 text-orange-300' :
                      'bg-cyan-500/20 text-cyan-300'
                    }`}>
                      {stint.sessionMode || 'FREE'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteStint(stint.id, e)}
                    className="text-gray-500 hover:text-red-400 p-0.5 cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="my-1">
                  <div className="text-xs font-mono font-black text-white">
                    {stint.totalLaps} Laps • {formatLapTime(stint.bestLapTime)}
                  </div>
                  <div className="text-[9px] font-mono text-gray-500">
                    {new Date(stint.createdAt).toLocaleDateString()} {new Date(stint.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono text-gray-400 pt-1 border-t border-white/5">
                  <span>{stint.topSpeedMph} MPH</span>
                  <span>{stint.peakLatG}G</span>
                  {stint.impacts && stint.impacts.length > 0 && (
                    <span className="text-red-400 font-bold">{stint.impacts.length} Hit{stint.impacts.length > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="p-6 text-center bg-[#0e0e16] border-white/10 space-y-2">
          <Activity size={28} className="mx-auto text-gray-600" />
          <h3 className="text-sm font-mono font-bold text-gray-300">No Stints Recorded Yet</h3>
          <p className="text-xs font-mono text-gray-500 max-w-md mx-auto">
            Click <strong className="text-emerald-400">RECORD STINT</strong> while driving in Forza, or import an existing stint JSON file.
          </p>
        </Card>
      )}

      {/* Active Stint Analysis View */}
      {activeStint && (
        <div className="space-y-4">
          {/* Stint Metadata & KPI Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            <Card className="p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">VEHICLE &amp; MODE</span>
              <div className="text-xs font-mono font-bold text-white truncate mt-1">
                {activeStint.carName}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Badge carClass={activeStint.carClass} className="text-[9px] self-start">
                  {activeStint.carClass} {activeStint.carPi}
                </Badge>
                <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {activeStint.sessionMode || 'FREE_ROAM'}
                </span>
              </div>
            </Card>

            <Card className="p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">
                {activeStint.sessionMode === 'DRIFT' ? 'MAX DRIFT ANGLE' : 'BEST LAP'}
              </span>
              <div className="text-sm sm:text-base font-mono font-black text-emerald-400 mt-1">
                {activeStint.sessionMode === 'DRIFT' 
                  ? `${activeStint.driftSummary?.maxAngleDeg || Math.round(Math.max(...activeStint.samples.map(s => Math.abs(s.slipAngleDelta))) * (180/Math.PI))}°` 
                  : formatLapTime(activeStint.bestLapTime)}
              </div>
              <span className="text-[9px] font-mono text-gray-500">
                {activeStint.sessionMode === 'DRIFT' ? `${activeStint.driftSummary?.timeInSlideSec || 0}s in slide` : `${activeStint.totalLaps} Laps total`}
              </span>
            </Card>

            <Card className="p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">TOP SPEED</span>
              <div className="text-sm sm:text-base font-mono font-black text-white mt-1">
                {activeStint.topSpeedMph} <span className="text-[10px] text-gray-500 font-normal">MPH</span>
              </div>
              <span className="text-[9px] font-mono text-gray-500">{Math.round(activeStint.topSpeedMph * 1.60934)} KM/H</span>
            </Card>

            <Card className="p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">PEAK LATERAL G</span>
              <div className="text-sm sm:text-base font-mono font-black text-cyan-400 mt-1">
                {activeStint.peakLatG} <span className="text-[10px] text-gray-500 font-normal">G</span>
              </div>
              <span className="text-[9px] font-mono text-gray-500">Lon: {activeStint.peakLonG}G</span>
            </Card>

            <Card className="p-3 bg-[#0e0e16] border-white/10 flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">PEAK TIRE TEMP</span>
              <div className="text-sm sm:text-base font-mono font-black text-amber-400 mt-1">
                {convertTemp(activeStint.peakTireTemp).value}{convertTemp(activeStint.peakTireTemp).label}
              </div>
              <span className="text-[9px] font-mono text-gray-500">
                {activeStint.driftSummary?.rearTempRiseRate ? `+${activeStint.driftSummary.rearTempRiseRate}°F/s build` : 'Peak Thermal Load'}
              </span>
            </Card>

            {/* AI & JSON Export Actions */}
            <Card className="p-2.5 bg-gradient-to-br from-[#121220] to-[#0c0c14] border-white/10 flex flex-col justify-between gap-1.5">
              <button
                onClick={copyAiPrompt}
                className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold transition-all cursor-pointer"
              >
                {copiedPrompt ? <Check size={12} className="text-emerald-400" /> : <Sparkles size={12} />}
                <span>{copiedPrompt ? 'Copied AI Prompt' : 'Copy AI Prompt'}</span>
              </button>

              <button
                onClick={() => downloadStintJsonFile(activeStint)}
                className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold transition-all cursor-pointer"
              >
                <Download size={12} />
                <span>Export Stint JSON</span>
              </button>
            </Card>
          </div>

          {/* Wall / Barrier Impacts Card (if any impacts detected) */}
          {activeStint.impacts && activeStint.impacts.length > 0 && (
            <Card className="p-4 bg-red-950/20 border-red-500/30 space-y-2">
              <div className="flex items-center justify-between text-red-400">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} />
                  <h3 className="text-xs font-mono font-black tracking-wider uppercase">
                    Wall &amp; Barrier Collisions Detected ({activeStint.impacts.length})
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-red-300 font-bold">
                  Peak Impact: {Math.max(...activeStint.impacts.map(i => i.impactG))}G
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {activeStint.impacts.map((imp, idx) => (
                  <div key={idx} className="bg-black/60 border border-red-500/20 rounded-lg p-2.5 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                        imp.severity === 'SEVERE' ? 'bg-red-500 text-white' :
                        imp.severity === 'MODERATE' ? 'bg-amber-500 text-black' : 'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {imp.severity} IMPACT
                      </span>
                      <span className="text-gray-400 text-[10px]">@{imp.timestamp}s</span>
                    </div>
                    <div className="text-white font-bold text-[11px]">
                      {imp.speedAtImpactMph} MPH ➔ -{imp.speedLostMph} MPH ({imp.impactG}G)
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Chart 1: Speed Trace & Pedal Input Overlay (Throttle / Brake) */}
          <Card className="p-4 bg-[#0e0e16] border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge size={16} className="text-cyan-400" />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Speed &amp; Pedal Modulation Trace
                </h3>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono font-bold">
                <span className="text-cyan-400">● Speed (MPH)</span>
                <span className="text-emerald-400">● Throttle %</span>
                <span className="text-red-400">● Brake %</span>
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="t" stroke="#6b7280" fontSize={10} tickFormatter={(v) => `${v}s`} />
                  <YAxis yAxisId="speed" stroke="#38bdf8" fontSize={10} domain={[0, 'auto']} />
                  <YAxis yAxisId="pedal" orientation="right" stroke="#10b981" fontSize={10} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a10', borderColor: '#ffffff20', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} 
                  />
                  <Area yAxisId="pedal" type="monotone" dataKey="throttle" stroke="#10b981" fill="#10b98120" strokeWidth={1.5} name="Throttle %" isAnimationActive={false} />
                  <Area yAxisId="pedal" type="monotone" dataKey="brake" stroke="#ef4444" fill="#ef444430" strokeWidth={1.5} name="Brake %" isAnimationActive={false} />
                  <Line yAxisId="speed" type="monotone" dataKey="speedMph" stroke="#38bdf8" strokeWidth={2} dot={false} name="Speed (MPH)" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Chart 2: Tire Thermal Degradation & Chassis Balance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 4-Corner Tire Thermal Degradation */}
            <Card className="p-4 bg-[#0e0e16] border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame size={16} className="text-amber-400" />
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Tire Thermal Degradation
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono font-bold">
                  <span className="text-sky-400">FL</span>
                  <span className="text-cyan-300">FR</span>
                  <span className="text-amber-400">RL</span>
                  <span className="text-rose-400">RR</span>
                </div>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="t" stroke="#6b7280" fontSize={10} tickFormatter={(v) => `${v}s`} />
                    <YAxis stroke="#9ca3af" fontSize={10} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0a10', borderColor: '#ffffff20', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} />
                    <Line type="monotone" dataKey="tempFl" stroke="#38bdf8" strokeWidth={1.5} dot={false} isAnimationActive={false} name="FL Temp (°F)" />
                    <Line type="monotone" dataKey="tempFr" stroke="#22d3ee" strokeWidth={1.5} dot={false} isAnimationActive={false} name="FR Temp (°F)" />
                    <Line type="monotone" dataKey="tempRl" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} name="RL Temp (°F)" />
                    <Line type="monotone" dataKey="tempRr" stroke="#f43f5e" strokeWidth={1.5} dot={false} isAnimationActive={false} name="RR Temp (°F)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Chassis Balance & Slip Angle Delta */}
            <Card className="p-4 bg-[#0e0e16] border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass size={16} className="text-emerald-400" />
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    {activeStint.sessionMode === 'DRIFT' ? 'Drift Slip Angle & Counter-Steer' : 'Chassis Balance (Under/Oversteer)'}
                  </h3>
                </div>
                <span className="text-[9px] font-mono text-gray-500 font-bold">
                  {activeStint.sessionMode === 'DRIFT' 
                    ? `Max Drift: ${activeStint.driftSummary?.maxAngleDeg || 0}°` 
                    : '< -0.06 Under | > 0.08 Over'}
                </span>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="t" stroke="#6b7280" fontSize={10} tickFormatter={(v) => `${v}s`} />
                    <YAxis yAxisId="slip" stroke="#10b981" fontSize={10} domain={['auto', 'auto']} />
                    <YAxis yAxisId="steer" orientation="right" stroke="#f59e0b" fontSize={10} domain={[-127, 127]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0a10', borderColor: '#ffffff20', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} />
                    <ReferenceLine yAxisId="slip" y={0} stroke="#ffffff40" />
                    <ReferenceLine yAxisId="slip" y={-0.06} stroke="#f59e0b50" strokeDasharray="3 3" />
                    <ReferenceLine yAxisId="slip" y={0.08} stroke="#22d3ee50" strokeDasharray="3 3" />
                    <Line yAxisId="slip" type="monotone" dataKey="slipAngleDelta" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} name="Slip Angle Delta" />
                    <Line yAxisId="steer" type="monotone" dataKey="steer" stroke="#f59e0b80" strokeWidth={1} dot={false} isAnimationActive={false} name="Steer Input (-127..+127)" strokeDasharray="2 2" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Stint Events Log */}
          {activeStint.events && activeStint.events.length > 0 && (
            <Card className="p-4 bg-[#0e0e16] border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle size={15} />
                <h3 className="text-xs font-mono font-black text-white uppercase tracking-wider">
                  Telemetry Events &amp; Anomalies ({activeStint.events.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {activeStint.events.map((ev, idx) => (
                  <div key={idx} className="bg-black/40 border border-white/5 rounded-lg p-2 flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-amber-400 font-bold block text-[10px]">{ev.type} (Lap {ev.lapNumber})</span>
                      <span className="text-gray-400 text-[11px]">{ev.description}</span>
                    </div>
                    <span className="text-gray-500 text-[10px] shrink-0 ml-2">@{ev.timestamp}s</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
