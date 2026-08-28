// Mathematical Forza Horizon Tuning Engine
// Ported and adapted from the consensus of 7 community tuning guides (forza.tools / forzafire / forzatune / forza.guide)

export type TuningGoal = 'circuit' | 'drag' | 'drift' | 'rally' | 'offroad' | 'touge' | 'speed';
export type DrivetrainType = 'rwd' | 'awd' | 'fwd';
export type EngineLocation = 'front' | 'mid' | 'rear';
export type TireCompound = 'stock' | 'street' | 'sport' | 'semi-slick' | 'slick' | 'drift' | 'rally' | 'offroad' | 'drag';
export type HandlingBalance = 'understeer' | 'neutral' | 'oversteer';

export interface CarSpecsInput {
  hp: number;
  torque: number;
  weightLbs: number;
  frontWeightPct: number; // e.g. 52 for 52%
  drivetrain: DrivetrainType;
  engineLocation: EngineLocation;
  tireCompound: TireCompound;
  carClass: 'd' | 'c' | 'b' | 'a' | 's1' | 's2' | 'x';
  gearCount: number;
  goal: TuningGoal;
  balanceFix: HandlingBalance;
}

export interface CalculatedTune {
  tires: {
    frontPSI: number;
    rearPSI: number;
    frontBar: number;
    rearBar: number;
    notes: string;
  };
  alignment: {
    camberFront: number;
    camberRear: number;
    toeFront: number;
    toeRear: number;
    caster: number;
    notes: string;
  };
  arbs: {
    front: number;
    rear: number;
    notes: string;
  };
  springs: {
    frontLbsIn: number;
    rearLbsIn: number;
    frontNmm: number;
    rearNmm: number;
    rideHeightFrontIn: number;
    rideHeightRearIn: number;
    rideHeightFrontCm: number;
    rideHeightRearCm: number;
    notes: string;
  };
  damping: {
    reboundFront: number;
    reboundRear: number;
    bumpFront: number;
    bumpRear: number;
    notes: string;
  };
  aero: {
    frontLbs: number;
    rearLbs: number;
    frontKgf: number;
    rearKgf: number;
    notes: string;
  };
  brakes: {
    balanceFront: number;
    pressurePct: number;
    notes: string;
  };
  differential: {
    rearAccel: number;
    rearDecel: number;
    frontAccel?: number;
    frontDecel?: number;
    centerBias?: number;
    notes: string;
  };
  gearing: {
    finalDrive: number;
    ratios: number[];
    estimatedTopSpeedMph: number;
    notes: string;
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function round(val: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}

const PSI_BASELINES: Record<TireCompound, number> = {
  stock: 31.0,
  street: 31.0,
  sport: 31.5,
  'semi-slick': 32.0,
  slick: 32.5,
  rally: 29.5,
  offroad: 29.0,
  drift: 23.0,
  drag: 25.0,
};

const CAMBER_RANGES: Record<TuningGoal, { fMin: number; fMax: number; rMin: number; rMax: number }> = {
  circuit: { fMin: -2.2, fMax: -1.2, rMin: -1.4, rMax: -0.6 },
  touge: { fMin: -2.0, fMax: -1.0, rMin: -1.2, rMax: -0.5 },
  speed: { fMin: -1.5, fMax: -0.5, rMin: -0.8, rMax: -0.3 },
  rally: { fMin: -1.2, fMax: -0.8, rMin: -0.8, rMax: -0.5 },
  offroad: { fMin: -0.5, fMax: -0.5, rMin: -0.5, rMax: -0.5 },
  drift: { fMin: -5.0, fMax: -3.0, rMin: -1.0, rMax: -0.5 },
  drag: { fMin: 0.0, fMax: 0.0, rMin: 0.0, rMax: 0.0 },
};

const DIFF_TABLE = {
  rwd: {
    circuit: { accel: 57, decel: 15 },
    touge: { accel: 55, decel: 15 },
    speed: { accel: 60, decel: 12 },
    rally: { accel: 60, decel: 20 },
    offroad: { accel: 60, decel: 20 },
    drift: { accel: 98, decel: 25 },
    drag: { accel: 85, decel: 5 },
  },
  fwd: {
    circuit: { accel: 25, decel: 5 },
    touge: { accel: 20, decel: 5 },
    speed: { accel: 30, decel: 5 },
    rally: { accel: 25, decel: 7 },
    offroad: { accel: 25, decel: 7 },
    drift: { accel: 35, decel: 5 },
    drag: { accel: 45, decel: 5 },
  },
  awd: {
    circuit: { fAccel: 28, fDecel: 0, rAccel: 100, rDecel: 45, center: 78 },
    touge: { fAccel: 20, fDecel: 7, rAccel: 72, rDecel: 17, center: 75 },
    speed: { fAccel: 29, fDecel: 0, rAccel: 65, rDecel: 10, center: 80 },
    rally: { fAccel: 35, fDecel: 7, rAccel: 62, rDecel: 22, center: 70 },
    offroad: { fAccel: 40, fDecel: 10, rAccel: 70, rDecel: 22, center: 60 },
    drift: { fAccel: 60, fDecel: 5, rAccel: 85, rDecel: 15, center: 55 },
    drag: { fAccel: 30, fDecel: 0, rAccel: 85, rDecel: 5, center: 80 },
  },
};

export function calculateForzaTune(specs: CarSpecsInput): CalculatedTune {
  const fw = specs.frontWeightPct / 100;
  const rw = 1 - fw;
  const wt = specs.weightLbs;

  // 1. TIRES
  let basePsi = PSI_BASELINES[specs.tireCompound] || 31.0;
  if (wt > 3300) basePsi += 1.5;
  if (wt < 2400) basePsi -= 1.5;

  let fPsi = basePsi + (fw - 0.5) * 4;
  let rPsi = basePsi + (rw - 0.5) * 4;

  if (specs.goal === 'drag') {
    fPsi = 35.0;
    rPsi = 22.0;
  } else if (specs.goal === 'drift') {
    fPsi = 28.0;
    rPsi = 22.0;
  }

  if (specs.balanceFix === 'understeer') fPsi -= 0.5;
  if (specs.balanceFix === 'oversteer') rPsi -= 0.5;

  fPsi = round(clamp(fPsi, 15, 45), 1);
  rPsi = round(clamp(rPsi, 15, 45), 1);

  // 2. ALIGNMENT
  const camberBracket = CAMBER_RANGES[specs.goal] || CAMBER_RANGES.circuit;
  let fCamber = camberBracket.fMin + (camberBracket.fMax - camberBracket.fMin) * (1 - fw);
  let rCamber = camberBracket.rMin + (camberBracket.rMax - camberBracket.rMin) * (1 - rw);

  if (specs.balanceFix === 'understeer') fCamber -= 0.3;
  if (specs.balanceFix === 'oversteer') rCamber -= 0.3;

  let caster = 6.2;
  if (wt > 3500) caster = 6.8;
  if (specs.goal === 'drift') caster = 7.0;

  let fToe = 0.0;
  let rToe = 0.0;
  if (specs.goal === 'drift') {
    fToe = -0.5;
    rToe = 0.1;
  } else if (specs.goal === 'touge') {
    fToe = 0.1;
  }

  // 3. ARBs (Anti-Roll Bars 1.0 - 65.0)
  let baseArbF = 65 * fw;
  let baseArbR = 65 * rw;

  if (specs.drivetrain === 'rwd') {
    baseArbF = clamp(baseArbF * 0.85, 5, 55);
    baseArbR = clamp(baseArbR * 1.15, 10, 60);
  }

  if (specs.balanceFix === 'understeer') {
    baseArbF -= 4.0;
    baseArbR += 3.0;
  } else if (specs.balanceFix === 'oversteer') {
    baseArbF += 3.0;
    baseArbR -= 4.0;
  }

  const arbF = round(clamp(baseArbF, 1, 65), 1);
  const arbR = round(clamp(baseArbR, 1, 65), 1);

  // 4. SPRINGS (lbs/in & N/mm)
  const springBaseLbs = wt * 0.22;
  let fSpringLbs = springBaseLbs * fw * 2.1;
  let rSpringLbs = springBaseLbs * rw * 2.1;

  if (specs.goal === 'drift') {
    fSpringLbs *= 1.1;
    rSpringLbs *= 0.9;
  } else if (specs.goal === 'rally' || specs.goal === 'offroad') {
    fSpringLbs *= 0.75;
    rSpringLbs *= 0.75;
  }

  const fSpringNmm = round(fSpringLbs * 0.175127, 1);
  const rSpringNmm = round(rSpringLbs * 0.175127, 1);

  // Ride Height
  let rhFIn = 4.2;
  let rhRIn = 4.6;
  if (specs.goal === 'rally' || specs.goal === 'offroad') {
    rhFIn = 7.5;
    rhRIn = 8.0;
  } else if (specs.goal === 'drag' || specs.goal === 'speed') {
    rhFIn = 3.2;
    rhRIn = 3.4;
  }

  // 5. DAMPING (Bump & Rebound)
  // Forzafire formula: Bump = ClassBase + (Weight / 200) * 0.1
  const bumpBase = specs.carClass === 's1' || specs.carClass === 's2' || specs.carClass === 'x' ? 4.6 : 4.4;
  let fBump = bumpBase + ((wt * fw) / 200) * 0.08;
  let rBump = bumpBase + ((wt * rw) / 200) * 0.08;

  if (specs.goal === 'rally' || specs.goal === 'offroad') {
    fBump *= 0.75;
    rBump *= 0.75;
  }

  let fRebound = fBump / 0.55;
  let rRebound = rBump / 0.55;

  fBump = round(clamp(fBump, 1.0, 20.0), 1);
  rBump = round(clamp(rBump, 1.0, 20.0), 1);
  fRebound = round(clamp(fRebound, 1.0, 20.0), 1);
  rRebound = round(clamp(rRebound, 1.0, 20.0), 1);

  // 6. DIFFERENTIAL
  const diffSettings = DIFF_TABLE[specs.drivetrain][specs.goal] || DIFF_TABLE.rwd.circuit;

  // 7. BRAKES
  let brakeBias = specs.drivetrain === 'fwd' ? 58 : specs.drivetrain === 'awd' ? 54 : 52;
  if (specs.balanceFix === 'understeer') brakeBias -= 2;

  // 8. AERO (Downforce)
  let fAeroLbs = 250;
  let rAeroLbs = 450;
  if (specs.goal === 'speed' || specs.goal === 'drag') {
    fAeroLbs = 75;
    rAeroLbs = 100;
  } else if (specs.goal === 'circuit' || specs.goal === 'touge') {
    fAeroLbs = 350;
    rAeroLbs = 550;
  }

  // 9. GEARING (1 to 10 gears)
  const topSpeedEst = round(13.6 * Math.pow(Math.max(50, specs.hp), 0.43) * 1.01, 0);
  const finalDrive = specs.goal === 'speed' || specs.goal === 'drag' ? 3.10 : specs.goal === 'rally' ? 4.10 : 3.55;

  // Compute geometric progression ratios
  const numGears = Math.min(10, Math.max(3, specs.gearCount || 6));
  const ratios: number[] = [];
  const startRatio = 3.10;
  const endRatio = 0.75;
  for (let i = 0; i < numGears; i++) {
    const t = i / (numGears - 1);
    const r = startRatio * Math.pow(endRatio / startRatio, t);
    ratios.push(round(r, 2));
  }

  return {
    tires: {
      frontPSI: fPsi,
      rearPSI: rPsi,
      frontBar: round(fPsi * 0.0689476, 2),
      rearBar: round(rPsi * 0.0689476, 2),
      notes: `${specs.tireCompound.toUpperCase()} compound tuned for ${specs.goal.toUpperCase()}`,
    },
    alignment: {
      camberFront: round(fCamber, 1),
      camberRear: round(rCamber, 1),
      toeFront: round(fToe, 1),
      toeRear: round(rToe, 1),
      caster: round(caster, 1),
      notes: `Optimal ${specs.goal.toUpperCase()} lateral footprint`,
    },
    arbs: {
      front: arbF,
      rear: arbR,
      notes: `Front:Rear weight ratio distribution (${specs.frontWeightPct}% F)`,
    },
    springs: {
      frontLbsIn: round(fSpringLbs, 0),
      rearLbsIn: round(rSpringLbs, 0),
      frontNmm: fSpringNmm,
      rearNmm: rSpringNmm,
      rideHeightFrontIn: round(rhFIn, 1),
      rideHeightRearIn: round(rhRIn, 1),
      rideHeightFrontCm: round(rhFIn * 2.54, 1),
      rideHeightRearCm: round(rhRIn * 2.54, 1),
      notes: `Matched to ${wt} lbs curb weight`,
    },
    damping: {
      reboundFront: fRebound,
      reboundRear: rRebound,
      bumpFront: fBump,
      bumpRear: rBump,
      notes: `0.55 bump-to-rebound dynamic compliance ratio`,
    },
    aero: {
      frontLbs: fAeroLbs,
      rearLbs: rAeroLbs,
      frontKgf: round(fAeroLbs * 0.453592, 0),
      rearKgf: round(rAeroLbs * 0.453592, 0),
      notes: `${specs.goal.toUpperCase()} downforce balance`,
    },
    brakes: {
      balanceFront: brakeBias,
      pressurePct: 100,
      notes: `${specs.drivetrain.toUpperCase()} threshold braking bias`,
    },
    differential: {
      rearAccel: (diffSettings as any).accel || (diffSettings as any).rAccel || 60,
      rearDecel: (diffSettings as any).decel || (diffSettings as any).rDecel || 15,
      frontAccel: (diffSettings as any).fAccel,
      frontDecel: (diffSettings as any).fDecel,
      centerBias: (diffSettings as any).center,
      notes: `${specs.goal.toUpperCase()} differential lock table`,
    },
    gearing: {
      finalDrive: finalDrive,
      ratios: ratios,
      estimatedTopSpeedMph: topSpeedEst,
      notes: `Estimated top speed: ${topSpeedEst} MPH`,
    },
  };
}
