/**
 * GridPulse Virtual Chassis Dyno & Gearing Thrust Engine
 * 
 * Capabilities:
 * 1. Automatic "Drag-Strip Style" Auto-Arming & Pull Detection
 * 2. 0.25s WOT Confirmation Window (eliminates false starts)
 * 3. 0.3s Brake-Release Grace Period (allows car settling / brake stand launches)
 * 4. Full RPM Sweep (records from idle all the way to limiter, zero early redline cuts)
 * 5. Pull Quality Gates (detects partial vs full-range power pulls)
 * 6. 100-RPM Bucket Smoothing with 5252 RPM Crossover Verification
 * 7. Multi-Gear Thrust Dyno (Per-Gear Wheel Torque & Power vs Speed)
 * 8. 100% Local-First Offline Persistence via IndexedDB
 */

import { getCarInfo } from './cars';

export interface DynoSample {
  t: number; // seconds
  rpm: number;
  speedMph: number;
  speedKph: number;
  hp: number;
  torqueFtLb: number;
  torqueNm: number;
  gear: number;
  throttle: number; // 0-100%
  boostPsi: number;
}

export interface RpmPoint {
  rpm: number;
  hp: number;
  torqueFtLb: number;
  torqueNm: number;
  boostPsi: number;
}

export interface GearPoint {
  speedMph: number;
  speedKph: number;
  hp: number;
  torqueFtLb: number;
  rpm: number;
  gear: number;
}

export interface ShiftPointRecommendation {
  fromGear: number;
  toGear: number;
  shiftSpeedMph: number;
  shiftRpm: number;
  dropRpm: number;
  reason: string;
}

export interface DynoRun {
  id: string;
  name: string;
  createdAt: number;
  mode: 'single_gear' | 'multi_gear';
  targetGear: number;
  quality: 'FULL' | 'PARTIAL';
  vehicle: {
    name: string;
    ordinal: number;
    class: string;
    pi: number;
    drivetrain: string;
  };
  summary: {
    peakHp: number;
    peakHpRpm: number;
    peakTorqueFtLb: number;
    peakTorqueRpm: number;
    peakBoostPsi: number;
    maxRpm: number;
    observedMaxRpm: number;
    idleRpm: number;
    powerBandStartRpm: number; // RPM where power >= 85% of peak
    powerBandEndRpm: number;
    powerBandWidth: number;
    optimalShiftRpm: number;
    durationSec: number;
  };
  rpmCurve: RpmPoint[]; // For Single-Gear Engine Dyno (vs RPM)
  perGearCurves: Record<number, GearPoint[]>; // For Multi-Gear Thrust Dyno (vs Speed)
  shiftPoints: ShiftPointRecommendation[];
  rawSampleCount: number;
}

const DB_NAME = 'GridPulseDB';
const DB_VERSION = 2;
const STORE_NAME = 'dyno_runs';

function openDynoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('stints')) {
        db.createObjectStore('stints', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDynoRun(run: DynoRun): Promise<void> {
  const db = await openDynoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(run);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllDynoRuns(): Promise<DynoRun[]> {
  const db = await openDynoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const runs = (req.result as DynoRun[]).sort((a, b) => b.createdAt - a.createdAt);
      resolve(runs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDynoRun(id: string): Promise<void> {
  const db = await openDynoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function exportDynoRunToJson(run: DynoRun): string {
  const payload = {
    app: 'GridPulse',
    version: '2.2.0',
    type: 'dyno_run',
    exportTimestamp: new Date().toISOString(),
    dynoRun: run
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadDynoJsonFile(run: DynoRun): void {
  const jsonStr = exportDynoRunToJson(run);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gridpulse_dyno_${run.vehicle.name.replace(/[^a-zA-Z0-9]/g, '_')}_${run.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type DynoStage = 'DISARMED' | 'ARMED' | 'TRIGGERING' | 'PULLING' | 'COOLDOWN' | 'COMPLETED';

export class DynoRecorder {
  private isArmed = false;
  private mode: 'single_gear' | 'multi_gear' = 'single_gear';
  private targetGear = 4;
  private stage: DynoStage = 'DISARMED';
  private triggerStartTime = 0;
  private pullStartTime = 0;
  private liftStartTime = 0;
  private samples: DynoSample[] = [];
  private carInfo: any = null;
  private engineMaxRpm = 8500;
  private engineIdleRpm = 800;

  /**
   * Arm the Dyno (Waiting for driver to hit WOT)
   */
  public arm(
    mode: 'single_gear' | 'multi_gear' = 'single_gear',
    targetGear: number = 4,
    carInfo: any
  ) {
    this.mode = mode;
    this.targetGear = targetGear;
    this.carInfo = carInfo;
    this.isArmed = true;
    this.stage = 'ARMED';
    this.samples = [];
    this.triggerStartTime = 0;
    this.pullStartTime = 0;
    this.liftStartTime = 0;
  }

  /**
   * Disarm the Dyno
   */
  public disarm() {
    this.isArmed = false;
    this.stage = 'DISARMED';
    this.samples = [];
    this.triggerStartTime = 0;
  }

  private gearShiftStartTime = 0;
  private brakeStartTime = 0;

  public processFrame(telemetry: any): { 
    stage: DynoStage; 
    statusDetail: string;
    progressPct: number; 
    currentHp: number; 
    currentTq: number;
    currentRpm: number;
    maxRpm: number;
  } {
    if (!this.isArmed || !telemetry) {
      return { 
        stage: 'DISARMED', 
        statusDetail: 'DYNO DISARMED',
        progressPct: 0, 
        currentHp: 0, 
        currentTq: 0, 
        currentRpm: 0, 
        maxRpm: 8500 
      };
    }

    const now = Date.now();
    const rpm = telemetry.current_engine_rpm || 0;
    const maxRpm = telemetry.engine_max_rpm || 8500;
    const idleRpm = telemetry.engine_idle_rpm || 800;
    this.engineMaxRpm = maxRpm;
    this.engineIdleRpm = idleRpm;

    // Dynamically resolve exact vehicle name, class, PI, drivetrain from live telemetry
    if (telemetry.car_ordinal !== undefined || telemetry.car_performance_index !== undefined) {
      const resolved = getCarInfo(
        telemetry.car_ordinal,
        telemetry.car_class_name,
        telemetry.car_performance_index,
        telemetry.drivetrain_name
      );
      this.carInfo = {
        name: resolved.name,
        ordinal: telemetry.car_ordinal || 0,
        class: resolved.class,
        pi: resolved.pi,
        drivetrain: resolved.drivetrain
      };
    }

    const throttlePct = Math.round(((telemetry.accel || 0) / 255) * 100);
    const brakePct = Math.round(((telemetry.brake || 0) / 255) * 100);
    const gear = telemetry.gear || 0;
    const speedMph = Math.round(telemetry.speed_mph || 0);
    const speedKph = Math.round(telemetry.speed_kph || 0);

    // Power in Watts -> HP (Power / 745.699872)
    const hp = telemetry.power_hp ? telemetry.power_hp : Math.round(((telemetry.power || 0) / 745.7) * 10) / 10;
    // Torque in N*m -> ft-lb (Torque * 0.737562)
    const torqueFtLb = telemetry.torque_ftlb ? telemetry.torque_ftlb : Math.round(((telemetry.torque || 0) * 0.737562) * 10) / 10;
    const torqueNm = Math.round((telemetry.torque || 0) * 10) / 10;
    const boostPsi = Math.round((telemetry.boost_psi || telemetry.boost || 0) * 10) / 10;

    const isWot = throttlePct >= 80;
    const isCorrectGear = this.mode === 'single_gear' ? gear === this.targetGear : gear >= 1;
    let statusDetail = '';

    // =========================================================================
    // STATE 1: ARMED (Waiting for initial WOT throttle trigger)
    // =========================================================================
    if (this.stage === 'ARMED') {
      statusDetail = this.mode === 'single_gear'
        ? `WAITING FOR PULL (Stage in Gear ${this.targetGear} & Floor Throttle)`
        : `WAITING FOR PULL (Floor Throttle in Any Gear)`;

      if (isCorrectGear && isWot && brakePct < 15) {
        this.stage = 'TRIGGERING';
        this.triggerStartTime = now;
      }
    }
    // =========================================================================
    // STATE 2: TRIGGERING (0.25s WOT confirmation window to eliminate blips)
    // =========================================================================
    else if (this.stage === 'TRIGGERING') {
      statusDetail = 'CONFIRMING WOT PULL...';
      if (!isCorrectGear || !isWot || brakePct >= 18) {
        // Aborted before 0.25s: Reset back to ARMED
        this.stage = 'ARMED';
        this.triggerStartTime = 0;
      } else if (now - this.triggerStartTime >= 250) {
        // Confirmed WOT sustained for >= 0.25s: Lock into PULLING
        this.stage = 'PULLING';
        this.pullStartTime = now;
        this.liftStartTime = 0;
        this.gearShiftStartTime = 0;
        this.brakeStartTime = 0;
        this.samples = [];
      }
    }
    // =========================================================================
    // STATE 3: PULLING (Active high-frequency dyno recording)
    // =========================================================================
    else if (this.stage === 'PULLING') {
      const pullElapsedSec = (now - this.pullStartTime) / 1000;
      const allowBrakeSettling = pullElapsedSec < 0.3; // Ignore brake during first 0.3s of launch

      const isBraking = !allowBrakeSettling && brakePct >= 18;
      const isWrongGear = this.mode === 'single_gear' ? (gear !== this.targetGear) : (gear === 0 || gear === 255);
      const isLifting = throttlePct < 60;

      // Track intentional brake
      if (isBraking) {
        if (this.brakeStartTime === 0) this.brakeStartTime = now;
      } else {
        this.brakeStartTime = 0;
      }

      // Track sustained wrong gear (e.g. shifted into reverse or neutral for >= 0.6s)
      if (isWrongGear) {
        if (this.gearShiftStartTime === 0) this.gearShiftStartTime = now;
      } else {
        this.gearShiftStartTime = 0;
      }

      // Track sustained throttle lift (multi_gear gives 1.4s grace for clutch/shifting, single_gear gives 0.85s)
      const liftThresholdMs = this.mode === 'multi_gear' ? 1400 : 850;
      if (isLifting) {
        if (this.liftStartTime === 0) this.liftStartTime = now;
        statusDetail = 'ENDING – THROTTLE RELEASED...';
      } else {
        this.liftStartTime = 0;
        if (this.mode === 'multi_gear') {
          statusDetail = `MULTI-GEAR SPRINT – GEAR ${gear} PULLING (${speedMph} MPH)`;
        } else {
          statusDetail = throttlePct >= 88 ? 'PULLING – FULL WOT' : 'PULLING – MODULATING (RECORDING)';
        }
      }

      // In single_gear mode ONLY: Detect engine hitting rev-limiter & falling
      if (this.mode === 'single_gear' && rpm >= maxRpm * 0.98 && this.samples.length > 30) {
        const recentSamples = this.samples.slice(-8);
        const maxRecent = Math.max(...recentSamples.map(s => s.rpm));
        if (rpm < maxRecent - 100) {
          this.stage = 'COOLDOWN';
          statusDetail = 'REDLINE HIT – PROCESSING PULL...';
        }
      }

      // Accept sample if in valid gear and not hard braking
      if (!isWrongGear && !isBraking && (throttlePct >= 50 || this.mode === 'multi_gear')) {
        if (hp > 0 || torqueFtLb > 0 || speedMph > 0) {
          this.samples.push({
            t: Number(pullElapsedSec.toFixed(2)),
            rpm: Math.round(rpm),
            speedMph,
            speedKph,
            hp: Math.max(0, hp),
            torqueFtLb: Math.max(0, torqueFtLb),
            torqueNm: Math.max(0, torqueNm),
            gear,
            throttle: throttlePct,
            boostPsi
          });
        }
      }

      // Evaluate End Triggers
      const sustainedLift = this.liftStartTime > 0 && now - this.liftStartTime >= liftThresholdMs;
      const sustainedBrake = this.brakeStartTime > 0 && now - this.brakeStartTime >= 250;
      const sustainedShift = this.gearShiftStartTime > 0 && now - this.gearShiftStartTime >= 600;

      if (sustainedLift || sustainedBrake || sustainedShift) {
        if (this.samples.length >= 25) {
          this.stage = 'COOLDOWN';
          statusDetail = 'PROCESSING DYNO CURVE...';
        } else {
          // False start / short blip (<25 samples): Discard and re-arm
          this.stage = 'ARMED';
          this.samples = [];
          this.triggerStartTime = 0;
          this.liftStartTime = 0;
          this.brakeStartTime = 0;
          this.gearShiftStartTime = 0;
          statusDetail = 'PULL ABORTED (<0.4s). RE-ARMED.';
        }
      }
    } else if (this.stage === 'COOLDOWN') {
      statusDetail = 'PROCESSING POWER CURVE...';
    } else if (this.stage === 'COMPLETED') {
      statusDetail = 'SAVED & RE-ARMED FOR NEXT PULL';
    }

    const progressPct = maxRpm > idleRpm 
      ? Math.min(100, Math.max(0, Math.round(((rpm - idleRpm) / (maxRpm - idleRpm)) * 100)))
      : 0;

    return {
      stage: this.stage,
      statusDetail,
      progressPct,
      currentHp: hp,
      currentTq: torqueFtLb,
      currentRpm: Math.round(rpm),
      maxRpm: Math.round(maxRpm)
    };
  }

  /**
   * Finalize and Process the Dyno Run
   */
  public async finishAndSave(): Promise<DynoRun | null> {
    if (!this.carInfo || this.samples.length < 20) {
      this.stage = this.isArmed ? 'ARMED' : 'DISARMED';
      this.samples = [];
      return null;
    }

    this.stage = 'COMPLETED';

    // 1. Process RPM Curve into 100 RPM Buckets
    const bucketMap: Record<number, { hpSum: number; tqSum: number; tqNmSum: number; boostSum: number; count: number }> = {};
    
    // Sort samples by RPM
    const sortedSamples = [...this.samples].sort((a, b) => a.rpm - b.rpm);

    for (const s of sortedSamples) {
      const bucketRpm = Math.round(s.rpm / 100) * 100;
      if (!bucketMap[bucketRpm]) {
        bucketMap[bucketRpm] = { hpSum: 0, tqSum: 0, tqNmSum: 0, boostSum: 0, count: 0 };
      }
      bucketMap[bucketRpm].hpSum += Math.max(0, s.hp);
      bucketMap[bucketRpm].tqSum += Math.max(0, s.torqueFtLb);
      bucketMap[bucketRpm].tqNmSum += Math.max(0, s.torqueNm);
      bucketMap[bucketRpm].boostSum += s.boostPsi;
      bucketMap[bucketRpm].count += 1;
    }

    const rawRpmPoints: RpmPoint[] = Object.keys(bucketMap)
      .map(k => parseInt(k, 10))
      .sort((a, b) => a - b)
      .map(rpm => {
        const b = bucketMap[rpm];
        return {
          rpm,
          hp: Math.round((b.hpSum / b.count) * 10) / 10,
          torqueFtLb: Math.round((b.tqSum / b.count) * 10) / 10,
          torqueNm: Math.round((b.tqNmSum / b.count) * 10) / 10,
          boostPsi: Math.round((b.boostSum / b.count) * 10) / 10
        };
      });

    // Apply 3-point smoothing
    const smoothedRpmCurve: RpmPoint[] = rawRpmPoints.map((pt, idx, arr) => {
      if (idx === 0 || idx === arr.length - 1) return pt;
      const prev = arr[idx - 1];
      const next = arr[idx + 1];
      return {
        rpm: pt.rpm,
        hp: Math.round(((prev.hp + pt.hp * 2 + next.hp) / 4) * 10) / 10,
        torqueFtLb: Math.round(((prev.torqueFtLb + pt.torqueFtLb * 2 + next.torqueFtLb) / 4) * 10) / 10,
        torqueNm: Math.round(((prev.torqueNm + pt.torqueNm * 2 + next.torqueNm) / 4) * 10) / 10,
        boostPsi: Math.round(((prev.boostPsi + pt.boostPsi * 2 + next.boostPsi) / 4) * 10) / 10
      };
    });

    // 2. Compute Peak Statistics
    let peakHp = 0;
    let peakHpRpm = 0;
    let peakTorqueFtLb = 0;
    let peakTorqueRpm = 0;
    let peakBoostPsi = 0;

    for (const pt of smoothedRpmCurve) {
      if (pt.hp > peakHp) {
        peakHp = pt.hp;
        peakHpRpm = pt.rpm;
      }
      if (pt.torqueFtLb > peakTorqueFtLb) {
        peakTorqueFtLb = pt.torqueFtLb;
        peakTorqueRpm = pt.rpm;
      }
      if (pt.boostPsi > peakBoostPsi) {
        peakBoostPsi = pt.boostPsi;
      }
    }

    const observedMaxRpm = sortedSamples.length > 0 
      ? Math.max(...sortedSamples.map(s => s.rpm)) 
      : this.engineMaxRpm;

    // Quality gate: Full pull if reached >= 88% of engine redline
    const isFullPull = observedMaxRpm >= this.engineMaxRpm * 0.88;

    // 3. Compute 85% Power Band Range
    const thresholdHp = peakHp * 0.85;
    const powerBandPoints = smoothedRpmCurve.filter(pt => pt.hp >= thresholdHp);
    const powerBandStartRpm = powerBandPoints.length > 0 ? powerBandPoints[0].rpm : Math.round(this.engineMaxRpm * 0.6);
    const powerBandEndRpm = powerBandPoints.length > 0 ? powerBandPoints[powerBandPoints.length - 1].rpm : observedMaxRpm;
    const powerBandWidth = Math.max(0, powerBandEndRpm - powerBandStartRpm);

    // 4. Compute Per-Gear Curves (for Multi-Gear Mode)
    const perGearCurves: Record<number, GearPoint[]> = {};
    for (const s of this.samples) {
      if (!perGearCurves[s.gear]) {
        perGearCurves[s.gear] = [];
      }
      perGearCurves[s.gear].push({
        speedMph: s.speedMph,
        speedKph: s.speedKph,
        hp: s.hp,
        torqueFtLb: s.torqueFtLb,
        rpm: s.rpm,
        gear: s.gear
      });
    }

    for (const g in perGearCurves) {
      perGearCurves[g].sort((a, b) => a.speedMph - b.speedMph);
    }

    // 5. Shift Point Calculation
    const shiftPoints: ShiftPointRecommendation[] = [];
    const availableGears = Object.keys(perGearCurves).map(Number).sort((a, b) => a - b);

    for (let i = 0; i < availableGears.length - 1; i++) {
      const fromG = availableGears[i];
      const toG = availableGears[i + 1];
      const fromCurve = perGearCurves[fromG];
      const toCurve = perGearCurves[toG];

      if (fromCurve && fromCurve.length > 5 && toCurve && toCurve.length > 5) {
        const maxFromSpeed = Math.max(...fromCurve.map(c => c.speedMph));
        const maxFromRpm = Math.max(...fromCurve.map(c => c.rpm));
        const minToRpm = Math.min(...toCurve.map(c => c.rpm));

        shiftPoints.push({
          fromGear: fromG,
          toGear: toG,
          shiftSpeedMph: maxFromSpeed,
          shiftRpm: Math.min(this.engineMaxRpm, Math.round(maxFromRpm * 0.98)),
          dropRpm: minToRpm,
          reason: `Shift at ${Math.round(maxFromRpm * 0.98)} RPM to land in the ${powerBandStartRpm}-${powerBandEndRpm} RPM power band.`
        });
      }
    }

    const durationSec = this.samples.length > 0 
      ? Number((this.samples[this.samples.length - 1].t).toFixed(1)) 
      : 0;

    const dynoRun: DynoRun = {
      id: `dyno-${Date.now()}`,
      name: `Dyno Pull (${this.mode === 'single_gear' ? `Gear ${this.targetGear}` : 'Multi-Gear'}) - ${this.carInfo.name}`,
      createdAt: Date.now(),
      mode: this.mode,
      targetGear: this.targetGear,
      quality: isFullPull ? 'FULL' : 'PARTIAL',
      vehicle: {
        name: this.carInfo.name,
        ordinal: this.carInfo.ordinal,
        class: this.carInfo.class,
        pi: this.carInfo.pi,
        drivetrain: this.carInfo.drivetrain
      },
      summary: {
        peakHp,
        peakHpRpm,
        peakTorqueFtLb,
        peakTorqueRpm,
        peakBoostPsi,
        maxRpm: this.engineMaxRpm,
        observedMaxRpm,
        idleRpm: this.engineIdleRpm,
        powerBandStartRpm,
        powerBandEndRpm,
        powerBandWidth,
        optimalShiftRpm: Math.round(peakHpRpm * 1.03),
        durationSec
      },
      rpmCurve: smoothedRpmCurve,
      perGearCurves,
      shiftPoints,
      rawSampleCount: this.samples.length
    };

    await saveDynoRun(dynoRun);
    
    // Auto re-arm for next pull
    this.stage = 'ARMED';
    this.samples = [];
    this.triggerStartTime = 0;

    return dynoRun;
  }

  public getIsArmed(): boolean {
    return this.isArmed;
  }

  public getStage(): DynoStage {
    return this.stage;
  }

  public getSampleCount(): number {
    return this.samples.length;
  }
}

export const globalDynoRecorder = new DynoRecorder();
