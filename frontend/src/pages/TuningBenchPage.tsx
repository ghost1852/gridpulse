import { useState, useMemo } from 'react';
import { useTelemetry } from '../hooks/useTelemetry';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { getCarInfo, saveCustomCar, type CarBuild } from '../lib/cars';
import { useUnits } from '../context/UnitContext';
import { 
  Wrench, 
  Sparkles, 
  Sliders, 
  Copy, 
  Check, 
  Activity,
  Disc,
  Compass,
  Cpu,
  CircleDot,
  Wind,
  ArrowUp,
  ArrowDown,
  Info,
  CheckCircle2,
  type LucideIcon
} from 'lucide-react';

interface TuningCategory {
  id: 'tires' | 'arbs' | 'springs' | 'damping' | 'diff' | 'brakes' | 'aero';
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
  description: string;
}

const CATEGORIES: TuningCategory[] = [
  { id: 'tires', label: 'Tires & Pressures', shortLabel: 'Tires', Icon: Disc, description: 'Thermal spread, grip thresholds & pressure balance' },
  { id: 'arbs', label: 'Anti-Roll Bars (ARBs)', shortLabel: 'ARBs', Icon: Compass, description: 'Mechanical grip, corner entry & mid-turn balance' },
  { id: 'springs', label: 'Springs & Ride Height', shortLabel: 'Springs', Icon: Activity, description: 'Suspension travel, bottoming out & weight transfer' },
  { id: 'damping', label: 'Damping & Shocks', shortLabel: 'Damping', Icon: Sliders, description: 'Rebound & bump compliance over curbs and transitions' },
  { id: 'diff', label: 'Differential', shortLabel: 'Diff', Icon: Cpu, description: 'Inside wheelspin on exit & off-throttle turn-in rotation' },
  { id: 'brakes', label: 'Brakes & Bias', shortLabel: 'Brakes', Icon: CircleDot, description: 'Axle lockup prevention & threshold braking stability' },
  { id: 'aero', label: 'Aerodynamics', shortLabel: 'Aero', Icon: Wind, description: 'High-speed downforce distribution & high-speed push' },
];

export function TuningBenchPage() {
  const { telemetry } = useTelemetry();
  const { convertTemp } = useUnits();
  const [activeCategory, setActiveCategory] = useState<TuningCategory['id']>('tires');
  const [copied, setCopied] = useState(false);

  // Car Metadata
  const carOrdinal = telemetry?.car_ordinal || 3767;
  const carClass = telemetry?.car_class_name || 'S1';
  const carPi = telemetry?.car_performance_index || 900;
  const drivetrain = telemetry?.drivetrain_name || 'AWD';
  const car = getCarInfo(carOrdinal, carClass, carPi, drivetrain);

  // Active build
  const build = car.build || {
    tireCompound: 'slick',
    aspiration: 'na',
    suspensionType: 'race',
    aeroType: 'full',
    tuningGoal: 'circuit',
  };

  const handleBuildChange = (updates: Partial<CarBuild>) => {
    saveCustomCar(carOrdinal, {
      build: {
        ...build,
        ...updates,
      }
    });
  };

  // Telemetry Derived Metrics
  const frontTempAvg = telemetry ? (telemetry.tire_temp_fl + telemetry.tire_temp_fr) / 2 : 180;
  const rearTempAvg = telemetry ? (telemetry.tire_temp_rl + telemetry.tire_temp_rr) / 2 : 180;
  const tempDelta = frontTempAvg - rearTempAvg; // > 0 = front hotter

  const frontSlipAvg = telemetry ? (Math.abs(telemetry.slip_angle_fl || 0) + Math.abs(telemetry.slip_angle_fr || 0)) / 2 : 0;
  const rearSlipAvg = telemetry ? (Math.abs(telemetry.slip_angle_rl || 0) + Math.abs(telemetry.slip_angle_rr || 0)) / 2 : 0;
  const handlingDelta = rearSlipAvg - frontSlipAvg; // < -0.05 = Understeer, > 0.08 = Oversteer

  const minSusp = telemetry ? Math.min(telemetry.susp_fl, telemetry.susp_fr, telemetry.susp_rl, telemetry.susp_rr) : 0.5;
  const isBottoming = minSusp < 0.04;

  const rearSlipRatio = telemetry ? Math.max(Math.abs(telemetry.slip_ratio_rl || 0), Math.abs(telemetry.slip_ratio_rr || 0)) : 0;
  const hasRearWheelspin = (telemetry?.accel || 0) > 80 && rearSlipRatio > 1.2;

  const frontSlipRatio = telemetry ? Math.max(Math.abs(telemetry.slip_ratio_fl || 0), Math.abs(telemetry.slip_ratio_fr || 0)) : 0;
  const hasFrontLockup = (telemetry?.brake || 0) > 80 && frontSlipRatio > 1.25;

  // Real, Concrete Tuning Advisories
  const advisories = useMemo(() => {
    const frontConv = convertTemp(frontTempAvg);
    const rearConv = convertTemp(rearTempAvg);
    const diffVal = Math.abs(Math.round(frontConv.value - rearConv.value));
    const optLow = convertTemp(170);
    const optHigh = convertTemp(215);

    return {
      tires: [
        {
          direction: tempDelta > 15 ? 'DECREASE' : (tempDelta < -15 ? 'INCREASE' : 'OPTIMAL'),
          target: 'Front Tire Pressure',
          action: tempDelta > 15 ? '▼ Lower Front Tire Pressure by 1.0 – 2.0 PSI (0.1 BAR)' : (tempDelta < -15 ? '▲ Increase Front Tire Pressure by 1.0 – 1.5 PSI' : '✓ Front Pressure is thermally balanced with rear'),
          reason: `Front tires are currently ${diffVal}${frontConv.label} ${tempDelta > 0 ? 'hotter' : 'cooler'} than rear tires.`,
          badge: tempDelta > 15 ? 'OVERHEATING FRONT' : (tempDelta < -15 ? 'UNDER-WORKED' : 'BALANCED'),
          severity: Math.abs(tempDelta) > 15 ? 'warning' : 'good'
        },
        {
          direction: rearTempAvg < 140 ? 'INCREASE' : (rearTempAvg > 230 ? 'DECREASE' : 'OPTIMAL'),
          target: 'Rear Tire Pressure',
          action: rearTempAvg < 140 ? '▲ Increase Rear Tire Pressure by 1.0 – 2.0 PSI to build friction heat' : (rearTempAvg > 230 ? '▼ Lower Rear Tire Pressure by 1.5 – 2.5 PSI' : '✓ Rear tire thermal envelope is optimal'),
          reason: `Rear average temperature is ${rearConv.value}${rearConv.label} (Optimal range: ${optLow.value}-${optHigh.value}${optLow.label}).`,
          badge: rearTempAvg < 140 ? 'COLD TIRES' : (rearTempAvg > 230 ? 'BLISTERING' : 'OPTIMAL'),
          severity: rearTempAvg < 140 || rearTempAvg > 230 ? 'warning' : 'good'
        },
        {
          direction: 'ADVISORY',
          target: 'Tire Compound Target',
          action: `Tuned for ${build.tireCompound.toUpperCase()} compound in ${build.tuningGoal.toUpperCase()} configuration.`,
          reason: 'Keep hot working pressures between 28.0 – 32.0 PSI (1.9 – 2.2 BAR) during hard cornering.',
          badge: 'COMPOUND TARGET',
          severity: 'info'
        }
      ],
      arbs: [
        {
          direction: handlingDelta < -0.06 ? 'DECREASE' : 'OPTIMAL',
          target: 'Front Anti-Roll Bar (ARB)',
          action: handlingDelta < -0.06 ? '▼ Soften Front ARB by 3 – 6 points (Increases front mechanical grip)' : '✓ Front ARB stiffness provides crisp initial turn-in',
          reason: handlingDelta < -0.06 ? 'Chassis is pushing wide (understeer) during corner entry and apex.' : 'Turn-in response is balanced.',
          badge: handlingDelta < -0.06 ? 'UNDERSTEER' : 'NEUTRAL',
          severity: handlingDelta < -0.06 ? 'warning' : 'good'
        },
        {
          direction: handlingDelta < -0.06 ? 'INCREASE' : (handlingDelta > 0.10 ? 'DECREASE' : 'OPTIMAL'),
          target: 'Rear Anti-Roll Bar (ARB)',
          action: handlingDelta < -0.06 ? '▲ Stiffen Rear ARB by 4 – 8 points to promote rotation' : (handlingDelta > 0.10 ? '▼ Soften Rear ARB by 5 – 10 points to tame oversteer' : '✓ Rear roll stiffness is well matched to front'),
          reason: handlingDelta < -0.06 ? 'Car resists rotating onto line at corner apex.' : (handlingDelta > 0.10 ? 'Excessive rear slip angle observed under lateral G.' : 'Chassis rotates cleanly.'),
          badge: handlingDelta > 0.10 ? 'OVERSTEER' : (handlingDelta < -0.06 ? 'NEEDS ROTATION' : 'BALANCED'),
          severity: Math.abs(handlingDelta) > 0.08 ? 'warning' : 'good'
        }
      ],
      springs: [
        {
          direction: isBottoming ? 'INCREASE' : 'OPTIMAL',
          target: 'Spring Rates & Ride Height',
          action: isBottoming ? '▲ Stiffen Springs by 10% & Raise Ride Height by +0.5 cm' : '✓ Suspension stroke travel has adequate bump-stop clearance',
          reason: isBottoming ? 'Suspension compressed past 96% travel (bottomed out on bump-stops).' : 'Suspension working within optimal stroke range.',
          badge: isBottoming ? 'BOTTOMING OUT' : 'OPTIMAL STROKE',
          severity: isBottoming ? 'danger' : 'good'
        },
        {
          direction: 'ADVISORY',
          target: 'Weight Distribution Baseline',
          action: `${car.drivetrain} setup target for ${build.tuningGoal.toUpperCase()}`,
          reason: 'Set front springs slightly stiffer than rear on front-engine layouts to stabilize braking pitch.',
          badge: 'GEOMETRY',
          severity: 'info'
        }
      ],
      damping: [
        {
          direction: 'ADVISORY',
          target: 'Rebound Damping',
          action: 'Set Rebound to ~60-65% of max slider value for high-speed body control',
          reason: 'Prevents excessive chassis oscillation after curbing or rapid chicane transitions.',
          badge: 'TRANSITIONS',
          severity: 'info'
        },
        {
          direction: 'ADVISORY',
          target: 'Bump Damping',
          action: 'Set Bump to ~50-55% of your Rebound setting (approx 30-35% of slider)',
          reason: 'Maintains tire contact compliance over rough track rumble strips.',
          badge: 'COMPLIANCE',
          severity: 'info'
        }
      ],
      diff: [
        {
          direction: hasRearWheelspin ? 'INCREASE' : 'OPTIMAL',
          target: 'Rear Acceleration Lock',
          action: hasRearWheelspin ? '▲ Increase Rear Acceleration Lock by +5 – 10% to lock rear axle' : '✓ Power delivery is balanced with rear traction',
          reason: hasRearWheelspin ? 'Inside drive wheel is spinning up under full throttle exit.' : 'Differential lock is delivering smooth corner exit drive.',
          badge: hasRearWheelspin ? 'WHEELSPIN' : 'OPTIMAL LOCK',
          severity: hasRearWheelspin ? 'warning' : 'good'
        },
        {
          direction: handlingDelta < -0.06 ? 'DECREASE' : 'OPTIMAL',
          target: 'Rear Deceleration Lock',
          action: handlingDelta < -0.06 ? '▼ Lower Deceleration Lock by -5 – 10% to free up turn-in' : '✓ Trail-braking stability is confident',
          reason: handlingDelta < -0.06 ? 'High deceleration lock is locking axle and forcing understeer off-throttle.' : 'Off-throttle balance is neutral.',
          badge: handlingDelta < -0.06 ? 'TURN-IN DRAG' : 'STABLE',
          severity: handlingDelta < -0.06 ? 'warning' : 'good'
        }
      ],
      brakes: [
        {
          direction: hasFrontLockup ? 'DECREASE' : 'OPTIMAL',
          target: 'Brake Balance Bias',
          action: hasFrontLockup ? '▼ Shift Brake Bias Rearward by 1 – 3% (e.g. 52% -> 50%)' : '✓ Brake balance distributes stopping force evenly',
          reason: hasFrontLockup ? 'Front tires locked up before rear tires reached braking limit.' : 'All 4 tires reaching deceleration peak simultaneously.',
          badge: hasFrontLockup ? 'FRONT LOCKUP' : 'BALANCED BIAS',
          severity: hasFrontLockup ? 'warning' : 'good'
        },
        {
          direction: 'ADVISORY',
          target: 'Brake Pressure',
          action: '100% – 110% Pressure recommended with ABS OFF',
          reason: 'Gives maximum pedal modulation resolution before threshold lockup.',
          badge: 'PRESSURE',
          severity: 'info'
        }
      ],
      aero: [
        {
          direction: 'ADVISORY',
          target: 'Front vs Rear Downforce Balance',
          action: build.aeroType === 'full' ? 'Increase Front Downforce to cure high-speed understeer' : 'Install adjustable race aero for high-speed stability',
          reason: 'Aerodynamic balance dominates cornering behavior above 90 MPH (145 KM/H).',
          badge: build.aeroType === 'full' ? 'AERO TUNABLE' : 'STOCK AERO',
          severity: 'info'
        }
      ]
    };
  }, [frontTempAvg, rearTempAvg, tempDelta, handlingDelta, isBottoming, hasRearWheelspin, hasFrontLockup, build, convertTemp, car.drivetrain]);

  const copyAdvisories = () => {
    let guide = `### GridPulse Mechanical Setup Guide\n`;
    guide += `**Vehicle**: ${car.name} (${car.class} ${car.pi} - ${car.drivetrain})\n`;
    guide += `**Build**: ${build.tireCompound.toUpperCase()} Tires | ${build.tuningGoal.toUpperCase()} Goal\n\n`;

    Object.entries(advisories).forEach(([cat, list]) => {
      guide += `#### ${cat.toUpperCase()}\n`;
      list.forEach(item => {
        guide += `- **${item.target}**: ${item.action}\n  *Reason: ${item.reason}*\n`;
      });
      guide += `\n`;
    });

    navigator.clipboard.writeText(guide);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeList = advisories[activeCategory] || [];

  return (
    <div className="p-2.5 sm:p-4 max-w-5xl w-full mx-auto space-y-3 pb-32 overflow-x-hidden">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#11111a] border border-white/10 rounded-2xl p-3 sm:p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-xl font-black font-mono text-white tracking-wider flex items-center gap-2">
              <Wrench size={18} className="text-emerald-400 shrink-0" />
              TELEMETRY TUNING ADVISOR
            </h1>
            <Badge carClass={car.class} className="text-[10px]">{car.class} {car.pi}</Badge>
          </div>
          <p className="text-[11px] sm:text-xs text-gray-400 font-mono mt-0.5">
            Real-time mechanical engineering advisories derived from live telemetry dynamics.
          </p>
        </div>

        <button
          onClick={copyAdvisories}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-[11px] sm:text-xs font-mono font-bold transition-all cursor-pointer shrink-0 self-start sm:self-auto"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          <span>{copied ? 'COPIED SETUP GUIDE' : 'COPY SETUP GUIDE'}</span>
        </button>
      </div>

      {/* Vehicle Build Calibration Controls (Responsive Grid: 1 col on mobile, 3 cols on desktop) */}
      <Card className="p-3 bg-[#0e0e16] border-white/10 space-y-2">
        <div className="text-[10px] font-mono font-bold text-gray-400 uppercase flex items-center gap-1.5">
          <Sparkles size={11} className="text-cyan-400" />
          <span>Vehicle Build Calibration</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Tire Compound */}
          <div>
            <label className="text-[9px] font-mono text-gray-400 block mb-0.5">TIRE COMPOUND</label>
            <select
              value={build.tireCompound}
              onChange={(e) => handleBuildChange({ tireCompound: e.target.value as any })}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
            >
              <option value="stock">Stock / Factory</option>
              <option value="street">Street Compound</option>
              <option value="sport">Sport Compound</option>
              <option value="semi-slick">Semi-Slick Compound</option>
              <option value="slick">Slick / Race Tires</option>
              <option value="drift">Drift Compound</option>
              <option value="rally">Rally Compound</option>
              <option value="offroad">Offroad Compound</option>
              <option value="drag">Drag Slicks</option>
            </select>
          </div>

          {/* Tuning Goal */}
          <div>
            <label className="text-[9px] font-mono text-gray-400 block mb-0.5">TUNING GOAL</label>
            <select
              value={build.tuningGoal}
              onChange={(e) => handleBuildChange({ tuningGoal: e.target.value as any })}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-xs font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-400"
            >
              <option value="circuit">Circuit / Grip Racing</option>
              <option value="drift">Drift / Angle &amp; Smoke</option>
              <option value="touge">Touge / Mountain Agility</option>
              <option value="drag">Drag Strip Acceleration</option>
              <option value="rally">Rally / Dirt Surface</option>
              <option value="speed">Top Speed V-Max</option>
            </select>
          </div>

          {/* Aero Package */}
          <div>
            <label className="text-[9px] font-mono text-gray-400 block mb-0.5">AERODYNAMICS</label>
            <select
              value={build.aeroType}
              onChange={(e) => handleBuildChange({ aeroType: e.target.value as any })}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-400"
            >
              <option value="full">Full Aero (Front + Rear)</option>
              <option value="rear_only">Rear Wing Only</option>
              <option value="none">No Adjustable Aero</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Category Selection Tabs (Wrap neatly on desktop, smooth horizontal scroll on mobile) */}
      <div className="flex flex-wrap sm:flex-nowrap gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(cat => {
          const Icon = cat.Icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-black'
                  : 'bg-[#11111a] text-gray-400 hover:text-white border border-white/10 hover:border-white/20'
              }`}
            >
              <Icon size={13} className="shrink-0" />
              <span>{cat.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Active Category Advisories Deck */}
      <div className="space-y-2.5">
        {activeList.map((item, idx) => (
          <Card key={idx} className="p-3 sm:p-4 bg-[#0e0e16] border-white/10 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block truncate">
                  {item.target}
                </span>
                <h3 className="text-xs sm:text-base font-mono font-black text-white mt-0.5 flex items-start gap-1.5 leading-snug break-words">
                  {item.direction.includes('INCREASE') && <ArrowUp size={15} className="text-emerald-400 shrink-0 mt-0.5" />}
                  {item.direction.includes('DECREASE') && <ArrowDown size={15} className="text-amber-400 shrink-0 mt-0.5" />}
                  {item.direction.includes('OPTIMAL') && <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />}
                  <span className="break-words">{item.action}</span>
                </h3>
              </div>

              <span className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold uppercase shrink-0 ${
                item.severity === 'danger' ? 'bg-red-500/20 border border-red-500/40 text-red-300' :
                item.severity === 'warning' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' :
                item.severity === 'good' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' :
                'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
              }`}>
                {item.badge}
              </span>
            </div>

            {/* Diagnostic Reason */}
            <div className="flex items-start gap-1.5 text-[11px] sm:text-xs font-mono text-gray-400 bg-black/40 p-2 sm:p-2.5 rounded-lg border border-white/5 leading-relaxed">
              <Info size={12} className="text-cyan-400 shrink-0 mt-0.5" />
              <span className="break-words">{item.reason}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
