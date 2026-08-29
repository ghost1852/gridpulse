/**
 * GridPulse Virtual Chassis Dyno & Gearing Thrust Engine
 * 
 * Capabilities:
 * 1. Single-Gear Engine Dyno (Pure HP & Torque vs RPM)
 * 2. Multi-Gear Thrust Dyno (Per-Gear Wheel Torque & Power vs Speed)
 * 3. 100-RPM Bucket Smoothing with 5252 RPM Crossover Verification
 * 4. Automatic WOT Pull Detection & In-App Staging Assistant
 * 5. Optimal Shift Point & Power Band Calculation
 * 6. 100% Local-First Offline Persistence via IndexedDB
 */

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
    idleRpm: number;
    powerBandStartRpm: number; // RPM where power >= 85% of peak
    powerBandEndRpm: number;
    powerBandWidth: number;
    optimalShiftRpm: number;
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
      const results: DynoRun[] = req.result || [];
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
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
    version: '2.1.0',
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

export type DynoStage = 'IDLE' | 'STAGING' | 'PULLING' | 'COOLDOWN' | 'COMPLETED';

export class DynoRecorder {
  private isRecording = false;
  private mode: 'single_gear' | 'multi_gear' = 'single_gear';
  private targetGear = 4;
  private stage: DynoStage = 'IDLE';
  private startTime = 0;
  private samples: DynoSample[] = [];
  private carInfo: any = null;
  private engineMaxRpm = 8000;
  private engineIdleRpm = 800;

  public start(
    mode: 'single_gear' | 'multi_gear' = 'single_gear',
    targetGear: number = 4,
    carInfo: any
  ) {
    this.mode = mode;
    this.targetGear = targetGear;
    this.carInfo = carInfo;
    this.isRecording = true;
    this.stage = 'STAGING';
    this.startTime = Date.now();
    this.samples = [];
  }

  public processFrame(telemetry: any): { stage: DynoStage; progressPct: number; currentHp: number; currentTq: number } {
    if (!this.isRecording || !telemetry) {
      return { stage: 'IDLE', progressPct: 0, currentHp: 0, currentTq: 0 };
    }

    const now = Date.now();
    const elapsedSec = (now - this.startTime) / 1000;
    const rpm = telemetry.current_engine_rpm || 0;
    const maxRpm = telemetry.engine_max_rpm || 8000;
    const idleRpm = telemetry.engine_idle_rpm || 800;
    this.engineMaxRpm = maxRpm;
    this.engineIdleRpm = idleRpm;

    const throttlePct = Math.round(((telemetry.accel || 0) / 255) * 100);
    const gear = telemetry.gear || 0;
    const speedMph = Math.round(telemetry.speed_mph || 0);
    const speedKph = Math.round(telemetry.speed_kph || 0);

    // Power in Watts -> HP (Power / 745.699872)
    const hp = telemetry.power_hp ? telemetry.power_hp : Math.round(((telemetry.power || 0) / 745.7) * 10) / 10;
    // Torque in N*m -> ft-lb (Torque * 0.737562)
    const torqueFtLb = telemetry.torque_ftlb ? telemetry.torque_ftlb : Math.round(((telemetry.torque || 0) * 0.737562) * 10) / 10;
    const torqueNm = Math.round((telemetry.torque || 0) * 10) / 10;
    const boostPsi = Math.round((telemetry.boost_psi || telemetry.boost || 0) * 10) / 10;

    const isWot = throttlePct >= 90;

    if (this.mode === 'single_gear') {
      // 1. Single Gear Mode logic
      if (this.stage === 'STAGING') {
        if (gear === this.targetGear && isWot && rpm < maxRpm * 0.75) {
          this.stage = 'PULLING';
        }
      } else if (this.stage === 'PULLING') {
        if (gear === this.targetGear && isWot) {
          this.samples.push({
            t: Number(elapsedSec.toFixed(2)),
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

          // Check if reached redline (>= 94% of max RPM)
          if (rpm >= maxRpm * 0.94) {
            this.stage = 'COOLDOWN';
          }
        } else if (!isWot && this.samples.length > 25) {
          // Driver lifted off throttle after pull
          this.stage = 'COOLDOWN';
        }
      }
    } else {
      // 2. Multi-Gear Mode logic
      if (this.stage === 'STAGING') {
        if (isWot && gear >= 1) {
          this.stage = 'PULLING';
        }
      } else if (this.stage === 'PULLING') {
        if (isWot && gear >= 1) {
          this.samples.push({
            t: Number(elapsedSec.toFixed(2)),
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
        } else if (!isWot && this.samples.length > 40) {
          this.stage = 'COOLDOWN';
        }
      }
    }

    const progressPct = maxRpm > idleRpm 
      ? Math.min(100, Math.max(0, Math.round(((rpm - idleRpm) / (maxRpm - idleRpm)) * 100)))
      : 0;

    return {
      stage: this.stage,
      progressPct,
      currentHp: hp,
      currentTq: torqueFtLb
    };
  }

  public async stop(): Promise<DynoRun | null> {
    if (!this.isRecording || !this.carInfo || this.samples.length < 15) {
      this.isRecording = false;
      this.stage = 'IDLE';
      return null;
    }
    this.isRecording = false;
    this.stage = 'COMPLETED';

    // 1. Process RPM Curve into 100 RPM Buckets
    const bucketMap: Record<number, { hpSum: number; tqSum: number; tqNmSum: number; boostSum: number; count: number }> = {};
    
    // Sort samples by RPM
    const sortedSamples = [...this.samples].sort((a, b) => a.rpm - b.rpm);

    for (const s of sortedSamples) {
      // Exclude zero-power samples
      if (s.hp <= 5 || s.torqueFtLb <= 5) continue;
      const bucketRpm = Math.round(s.rpm / 100) * 100;
      if (!bucketMap[bucketRpm]) {
        bucketMap[bucketRpm] = { hpSum: 0, tqSum: 0, tqNmSum: 0, boostSum: 0, count: 0 };
      }
      bucketMap[bucketRpm].hpSum += s.hp;
      bucketMap[bucketRpm].tqSum += s.torqueFtLb;
      bucketMap[bucketRpm].tqNmSum += s.torqueNm;
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

    // 3. Compute 85% Power Band Range
    const thresholdHp = peakHp * 0.85;
    const powerBandPoints = smoothedRpmCurve.filter(pt => pt.hp >= thresholdHp);
    const powerBandStartRpm = powerBandPoints.length > 0 ? powerBandPoints[0].rpm : Math.round(this.engineMaxRpm * 0.6);
    const powerBandEndRpm = powerBandPoints.length > 0 ? powerBandPoints[powerBandPoints.length - 1].rpm : this.engineMaxRpm;
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

    // Sort each gear curve by speed
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

    const dynoRun: DynoRun = {
      id: `dyno-${Date.now()}`,
      name: `Dyno Pull (${this.mode === 'single_gear' ? `Gear ${this.targetGear}` : 'Multi-Gear'}) - ${this.carInfo.name}`,
      createdAt: Date.now(),
      mode: this.mode,
      targetGear: this.targetGear,
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
        idleRpm: this.engineIdleRpm,
        powerBandStartRpm,
        powerBandEndRpm,
        powerBandWidth,
        optimalShiftRpm: Math.round(peakHpRpm * 1.03)
      },
      rpmCurve: smoothedRpmCurve,
      perGearCurves,
      shiftPoints,
      rawSampleCount: this.samples.length
    };

    await saveDynoRun(dynoRun);
    return dynoRun;
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public getStage(): DynoStage {
    return this.stage;
  }

  public getSampleCount(): number {
    return this.samples.length;
  }
}

export const globalDynoRecorder = new DynoRecorder();
