import { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/Card';
import { Wrench, Sparkles, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';

export interface PersistentRecommendation {
  id: string;
  category: 'Camber' | 'Suspension' | 'Tires' | 'Diff & Aero' | 'Brake Bias';
  severity: 'urgent' | 'recommend';
  title: string;
  suggestion: string;
  reason: string;
  timestamp: string;
  count: number;
}

interface RaceEngineerProps {
  tireTempFl: number;
  tireTempFr: number;
  tireTempRl: number;
  tireTempRr: number;
  suspFl: number;
  suspFr: number;
  suspRl: number;
  suspRr: number;
  slipFl: number;
  slipFr: number;
  slipRl: number;
  slipRr: number;
  steer: number;
  brake: number;
  speedMph: number;
}

export function TuningRecommendations({
  tireTempFl,
  tireTempFr,
  tireTempRl,
  tireTempRr,
  suspFl,
  suspFr,
  suspRl,
  suspRr,
  slipFl,
  slipFr,
  slipRl,
  slipRr,
  steer,
  brake,
  speedMph,
}: RaceEngineerProps) {
  const [log, setLog] = useState<PersistentRecommendation[]>(() => {
    try {
      const saved = localStorage.getItem('forza_tuning_recommendations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const lastTriggerRef = useRef<Record<string, number>>({});

  const addOrIncrement = (item: Omit<PersistentRecommendation, 'timestamp' | 'count'>) => {
    const now = Date.now();
    const lastTime = lastTriggerRef.current[item.id] || 0;
    // Debounce to at least 4 seconds between counting the same event
    if (now - lastTime < 4000) return;
    lastTriggerRef.current[item.id] = now;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setLog(prev => {
      const existingIdx = prev.findIndex(r => r.id === item.id);
      let updated: PersistentRecommendation[];
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          count: updated[existingIdx].count + 1,
          timestamp: timeStr,
          reason: item.reason,
        };
      } else {
        updated = [{ ...item, timestamp: timeStr, count: 1 }, ...prev].slice(0, 10);
      }
      try {
        localStorage.setItem('forza_tuning_recommendations', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Evaluate driving physics at 60Hz and capture issues
  useEffect(() => {
    // 1. Suspension Bottom-out
    if (suspFl < 0.05 || suspFr < 0.05 || suspRl < 0.05 || suspRr < 0.05) {
      addOrIncrement({
        id: 'susp-bottom',
        category: 'Suspension',
        severity: 'urgent',
        title: 'Damper Bottoming Out On Bump Stops',
        suggestion: 'Stiffen Springs (+15%) or raise Ride Height (+0.5")',
        reason: 'Suspension travel reached 98%+ compression during driving.',
      });
    }

    // 2. Overheating Tires
    const maxT = Math.max(tireTempFl, tireTempFr, tireTempRl, tireTempRr);
    if (maxT >= 240) {
      addOrIncrement({
        id: 'tire-overheat',
        category: 'Tires',
        severity: 'urgent',
        title: 'Tire Overheating Past Optimal Grip',
        suggestion: 'Lower tire pressures by 1.5 - 2.0 PSI or reduce slide angle',
        reason: `Peak tire thermal reached ${Math.round(maxT)}°F (optimal is 180°F - 215°F).`,
      });
    }

    // 3. Camber Axle Imbalance
    const avgFront = (tireTempFl + tireTempFr) / 2;
    const avgRear = (tireTempRl + tireTempRr) / 2;
    if (avgFront > avgRear + 30 && speedMph > 40) {
      addOrIncrement({
        id: 'camber-front',
        category: 'Camber',
        severity: 'recommend',
        title: 'Front Axle Thermal Overload',
        suggestion: 'Increase Negative Front Camber (-0.3° to -0.6°)',
        reason: 'Front tires taking excessive lateral friction compared to rear.',
      });
    }

    // 4. Understeer
    const frontSlip = Math.max(slipFl, slipFr);
    const rearSlip = Math.max(slipRl, slipRr);
    if (Math.abs(steer) > 0.4 && frontSlip > rearSlip + 0.6 && speedMph > 35) {
      addOrIncrement({
        id: 'diff-understeer',
        category: 'Diff & Aero',
        severity: 'recommend',
        title: 'Corner Entry Understeer',
        suggestion: 'Soften Front Anti-Roll Bar (-2 clicks) or increase Front Downforce',
        reason: 'Front tires sliding before rear tires during steering input.',
      });
    } else if (rearSlip > frontSlip + 0.8 && speedMph > 35) {
      addOrIncrement({
        id: 'diff-oversteer',
        category: 'Diff & Aero',
        severity: 'recommend',
        title: 'Corner Exit Power Oversteer',
        suggestion: 'Soften Rear Anti-Roll Bar (-3 clicks) or lower Acceleration Differential lock',
        reason: 'Rear tires breaking traction under power.',
      });
    }

    // 5. Brake Lockup
    if (brake > 220 && (slipFl > 1.4 || slipFr > 1.4)) {
      addOrIncrement({
        id: 'brake-lockup',
        category: 'Brake Bias',
        severity: 'recommend',
        title: 'Front Axle Brake Lockup',
        suggestion: 'Shift Brake Balance Rearward (-2% to -4% Front Bias)',
        reason: 'Front wheels locking up before rear under hard threshold braking.',
      });
    }
  }, [tireTempFl, tireTempFr, tireTempRl, tireTempRr, suspFl, suspFr, suspRl, suspRr, slipFl, slipFr, slipRl, slipRr, steer, brake, speedMph]);

  const clearLog = () => {
    setLog([]);
    localStorage.removeItem('forza_tuning_recommendations');
  };

  return (
    <Card className="p-5 flex flex-col justify-between bg-[#0e0e16] border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Wrench size={16} />
          </div>
          <div>
            <h3 className="text-sm font-mono font-bold text-white tracking-wider">
              RACE ENGINEER • SETUP ADVISOR &amp; TELEMETRY LOG
            </h3>
            <p className="text-[10px] font-mono text-gray-400">
              Persistent engineering recommendations recorded during your stint
            </p>
          </div>
        </div>

        {log.length > 0 && (
          <button
            onClick={clearLog}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-red-500/20 text-[11px] font-mono text-gray-400 hover:text-red-300 transition-colors cursor-pointer"
          >
            <Trash2 size={12} />
            <span>Clear Log</span>
          </button>
        )}
      </div>

      {/* Recommendations List */}
      <div className="space-y-3 font-mono">
        {log.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-white/10 text-center space-y-2">
            <CheckCircle2 size={24} className="text-emerald-400 mx-auto" />
            <div className="text-sm font-bold text-white">Chassis &amp; Grip Running In Optimal Window</div>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Drive hard through turns, braking zones, and bumps — any bottom-outs, thermal spikes, or handling imbalances will be permanently logged here with exact setup solutions.
            </p>
          </div>
        ) : (
          log.map(rec => (
            <div 
              key={rec.id}
              className={`p-4 rounded-xl border transition-all ${
                rec.severity === 'urgent' 
                  ? 'bg-red-500/10 border-red-500/40 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertTriangle size={15} className={rec.severity === 'urgent' ? 'text-red-400' : 'text-amber-400'} />
                  <span className="text-white">{rec.title}</span>
                  {rec.count > 1 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/30 border border-red-500/50 text-red-300 font-black">
                      {rec.count}x DETECTED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">{rec.timestamp}</span>
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-black/50 text-gray-300 border border-white/10 font-bold">
                    {rec.category}
                  </span>
                </div>
              </div>

              <div className="text-xs font-bold text-emerald-300 mt-2 bg-black/40 p-2.5 rounded-lg border border-emerald-500/20 flex items-start gap-2">
                <Wrench size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Recommended Fix:</strong> {rec.suggestion}</span>
              </div>

              <div className="text-[11px] text-gray-400 mt-2">
                <strong>Telemetry Evidence:</strong> {rec.reason}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="text-[11px] font-mono text-gray-500 pt-3 mt-4 border-t border-white/5 flex justify-between items-center">
        <span>Logged telemetry events are saved to local garage</span>
        <span className="text-emerald-400 font-bold flex items-center gap-1">
          <Sparkles size={12} /> GridPulse Race Engineer v2.0
        </span>
      </div>
    </Card>
  );
}
