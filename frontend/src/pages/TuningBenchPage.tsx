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
  Icon: LucideIcon;
  description: string;
}

const CATEGORIES: TuningCategory[] = [
  { id: 'tires', label: 'Tires & Pressures', Icon: Disc, description: 'Thermal spread, grip thresholds & pressure balance' },
  { id: 'arbs', label: 'Anti-Roll Bars (ARBs)', Icon: Compass, description: 'Mechanical grip, corner entry & mid-turn balance' },
  { id: 'springs', label: 'Springs & Ride Height', Icon: Activity, description: 'Suspension travel, bottoming out & weight transfer' },
  { id: 'damping', label: 'Damping & Shocks', Icon: Sliders, description: 'Rebound & bump compliance over curbs and transitions' },
  { id: 'diff', label: 'Differential', Icon: Cpu, description: 'Inside wheelspin on exit & off-throttle turn-in rotation' },
  { id: 'brakes', label: 'Brakes & Bias', Icon: CircleDot, description: 'Axle lockup prevention & threshold braking stability' },
  { id: 'aero', label: 'Aerodynamics', Icon: Wind, description: 'High-speed downforce distribution & high-speed push' },
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
          badge: handlingDelta > 0.10 ? 'OVERSTEER' : (handlingDelta < -0.06 ? 'UNDERSTEER' : 'BALANCED'),
          severity: Math.abs(handlingDelta) > 0.07 ? 'warning' : 'good'
        }
      ],
      springs: [
        {
          direction: isBottoming ? 'INCREASE' : 'OPTIMAL',
          target: 'Front & Rear Springs',
          action: isBottoming ? '▲ Stiffen Springs by +50 – 100 N/mm or +30 – 50 lbs/in' : '✓ Spring rates provide adequate travel without bottoming',
          reason: isBottoming ? 'Suspension reached 96%+ maximum travel (bump stop impact detected).' : `Minimum travel remaining is ${Math.round(minSusp * 100)}%.`,
          badge: isBottoming ? 'BOTTOMING OUT' : 'NOMINAL TRAVEL',
          severity: isBottoming ? 'danger' : 'good'
        },
        {
          direction: isBottoming ? 'INCREASE' : 'OPTIMAL',
          target: 'Ride Height',
          action: isBottoming ? '▲ Raise Ride Height by +0.5 – 1.0 cm (+0.2 – 0.4 in)' : '✓ Ground clearance is optimal for aerodynamic floor sealing',
          reason: isBottoming ? 'Chassis is scraping curbs or track compression dips.' : 'No chassis scraping detected.',
          badge: isBottoming ? 'RAISE CHASSIS' : 'OPTIMAL HEIGHT',
          severity: isBottoming ? 'danger' : 'good'
        }
      ],
      damping: [
        {
          direction: 'ADVISORY',
          target: 'Front & Rear Rebound Damping',
          action: 'Set Rebound stiffness to approximately 55 – 65% of max scale (e.g. 10.0 – 12.5)',
          reason: 'Controls spring expansion after compression over curbs and braking dive.',
          badge: 'REBOUND BALANCE',
          severity: 'info'
        },
        {
          direction: 'ADVISORY',
          target: 'Front & Rear Bump Damping',
          action: 'Set Bump stiffness to 50 – 60% of Rebound stiffness (e.g. 5.5 – 7.5)',
          reason: 'Prevents harsh deflection when hitting rumble strips or road crowns.',
          badge: 'BUMP COMPLIANCE',
          severity: 'info'
        }
      ],
      diff: [
        {
          direction: hasRearWheelspin ? 'DECREASE' : 'OPTIMAL',
          target: 'Rear Acceleration Lock (%)',
          action: hasRearWheelspin ? '▼ Lower Rear Accel Lock by 5 – 10% (or ▲ Stiffen if one-wheel peeling)' : '✓ Rear differential lock delivers smooth exit traction',
          reason: hasRearWheelspin ? 'Inside driven wheel is breaking traction under corner exit power.' : 'Power delivery is symmetrical.',
          badge: hasRearWheelspin ? 'WHEELSPIN' : 'TRACTION LOCKED',
          severity: hasRearWheelspin ? 'warning' : 'good'
        },
        {
          direction: handlingDelta < -0.06 ? 'DECREASE' : 'OPTIMAL',
          target: 'Rear Deceleration Lock (%)',
          action: handlingDelta < -0.06 ? '▼ Lower Rear Decel Lock to 0% – 15% (Allows car to pivot off-throttle)' : '✓ Decel lock provides stable entry without push',
          reason: 'High decel locking forces wheels to turn at same speed off-throttle, causing entry push.',
          badge: 'TURN-IN ROTATION',
          severity: handlingDelta < -0.06 ? 'warning' : 'good'
        }
      ],
      brakes: [
        {
          direction: hasFrontLockup ? 'SHIFT REARWARD' : 'OPTIMAL',
          target: 'Brake Balance (% Front)',
          action: hasFrontLockup ? '◄ Shift Brake Bias 2 – 4% Rearward (e.g. from 52% down to 48% Front)' : '✓ Brake balance decelerates all 4 wheels evenly',
          reason: hasFrontLockup ? 'Front axle is locking up before rear, causing loss of steering control.' : 'Threshold braking is stable.',
          badge: hasFrontLockup ? 'FRONT LOCKUP' : 'BALANCED BIAS',
          severity: hasFrontLockup ? 'danger' : 'good'
        },
        {
          direction: 'ADVISORY',
          target: 'Brake Pressure (%)',
          action: 'Set Brake Pressure between 90% – 100% (Avoid 130%+ to prevent instant lockup)',
          reason: 'Provides a progressive pedal threshold for trail-braking into corner apex.',
          badge: 'PEDAL MODULATION',
          severity: 'info'
        }
      ],
      aero: [
        {
          direction: handlingDelta < -0.06 ? 'INCREASE FRONT' : 'OPTIMAL',
          target: 'Front Downforce Wing',
          action: handlingDelta < -0.06 ? '▲ Increase Front Downforce (+15 – 30 KGF / LBS)' : '✓ Aerodynamic balance is matched to chassis speed',
          reason: 'Increases high-speed front front grip (>80 mph / 130 km/h) in fast sweepers.',
          badge: 'HIGH-SPEED GRIP',
          severity: 'info'
        },
        {
          direction: 'ADVISORY',
          target: 'Rear Downforce Wing',
          action: 'Adjust Rear Wing to balance high-speed stability against straight-line top speed drag',
          reason: 'Higher rear aero stabilizes high-speed braking at the cost of 2-5 mph top speed.',
          badge: 'TOP SPEED VS GRIP',
          severity: 'info'
        }
      ]
    };
  }, [tempDelta, frontTempAvg, rearTempAvg, handlingDelta, isBottoming, minSusp, hasRearWheelspin, hasFrontLockup, build, convertTemp]);

  const copyAdvisories = () => {
    let text = `GRIDPULSE TELEMETRY TUNING ADVISORY\nVehicle: ${car.name} (${car.manufacturer})\nClass: ${car.class} (PI ${car.pi}) | Drivetrain: ${car.drivetrain}\nGoal: ${build.tuningGoal.toUpperCase()} | Compound: ${build.tireCompound.toUpperCase()}\n\n`;
    
    Object.entries(advisories).forEach(([cat, list]) => {
      text += `[${cat.toUpperCase()}]\n`;
      list.forEach(item => {
        text += `• ${item.target}: ${item.action} (${item.reason})\n`;
      });
      text += '\n';
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeList = advisories[activeCategory] || [];

  return (
    <div className="p-3 sm:p-4 max-w-5xl mx-auto space-y-4 pb-28">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#11111a] border border-white/10 rounded-2xl p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black font-mono text-white tracking-wider flex items-center gap-2">
              <Wrench size={20} className="text-emerald-400" />
              TELEMETRY TUNING ADVISOR
            </h1>
            <Badge carClass={car.class} className="text-xs">{car.class} {car.pi}</Badge>
          </div>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Real-time mechanical engineering advisories derived from live telemetry dynamics.
          </p>
        </div>

        <button
          onClick={copyAdvisories}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-xs font-mono font-bold transition-all cursor-pointer shrink-0"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          <span>{copied ? 'COPIED SETUP GUIDE' : 'COPY SETUP GUIDE'}</span>
        </button>
      </div>

      {/* Vehicle Build Calibration Controls */}
      <Card className="p-3 bg-[#0e0e16] border-white/10">
        <div className="text-[11px] font-mono font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
          <Sparkles size={12} className="text-cyan-400" />
          <span>Vehicle Build Calibration</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* Tire Compound */}
          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">TIRE COMPOUND</label>
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
            <label className="text-[10px] font-mono text-gray-400 block mb-1">TUNING GOAL</label>
            <select
              value={build.tuningGoal}
              onChange={(e) => handleBuildChange({ tuningGoal: e.target.value as any })}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-xs font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-400"
            >
              <option value="circuit">Circuit / Grip Racing</option>
              <option value="drift">Drift / Angle & Smoke</option>
              <option value="touge">Touge / Mountain Agility</option>
              <option value="drag">Drag Strip Acceleration</option>
              <option value="rally">Rally / Dirt Surface</option>
              <option value="speed">Top Speed V-Max</option>
            </select>
          </div>

          {/* Aero Package */}
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] font-mono text-gray-400 block mb-1">AERODYNAMICS</label>
            <select
              value={build.aeroType}
              onChange={(e) => handleBuildChange({ aeroType: e.target.value as any })}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-400"
            >
              <option value="full">Full Aero (Front Splitter + Rear Wing)</option>
              <option value="rear_only">Rear Wing Only</option>
              <option value="none">No Adjustable Aero</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Category Selection Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(cat => {
          const Icon = cat.Icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-black'
                  : 'bg-[#11111a] text-gray-400 hover:text-white border border-white/10 hover:border-white/20'
              }`}
            >
              <Icon size={14} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Category Advisories Deck */}
      <div className="space-y-3">
        {activeList.map((item, idx) => (
          <Card key={idx} className="p-4 bg-[#0e0e16] border-white/10 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">
                  {item.target}
                </span>
                <h3 className="text-base sm:text-lg font-mono font-black text-white mt-0.5 flex items-center gap-1.5">
                  {item.direction.includes('INCREASE') && <ArrowUp size={16} className="text-emerald-400" />}
                  {item.direction.includes('DECREASE') && <ArrowDown size={16} className="text-amber-400" />}
                  {item.direction.includes('OPTIMAL') && <CheckCircle2 size={16} className="text-emerald-400" />}
                  <span>{item.action}</span>
                </h3>
              </div>

              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase shrink-0 ${
                item.severity === 'danger' ? 'bg-red-500/20 border border-red-500/40 text-red-300' :
                item.severity === 'warning' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' :
                item.severity === 'good' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' :
                'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
              }`}>
                {item.badge}
              </span>
            </div>

            {/* Diagnostic Reason */}
            <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400 bg-black/40 p-2.5 rounded-lg border border-white/5">
              <Info size={13} className="text-cyan-400 shrink-0" />
              <span>{item.reason}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
