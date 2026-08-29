/**
 * GridPulse Local-First Stint & Telemetry Recording Engine
 * Stores full session telemetry stints directly into browser IndexedDB.
 * Zero cloud storage, 100% offline persistence, AI-ready JSON export.
 * 
 * Features:
 * - Session Type System: DRIFT, TIME_ATTACK, CIRCUIT, SPRINT, OFFROAD, FREE_ROAM
 * - Physics-based Wall & Barrier Impact Detection (with Peak G & Speed Loss)
 * - Off-Road Jump & Airborne Detection
 * - Style-specific Derived Metrics (Slip Angle Histograms, Thermal Rise Rates, Consistency Scores)
 */

export type SessionMode = 'DRIFT' | 'TIME_ATTACK' | 'CIRCUIT' | 'SPRINT' | 'OFFROAD' | 'FREE_ROAM';

export interface TelemetrySample {
  t: number; // relative seconds from stint start
  speedMph: number;
  speedKph: number;
  rpm: number;
  gear: number;
  throttle: number; // 0-100%
  brake: number; // 0-100%
  steer: number; // -127 to +127
  gLat: number;
  gLon: number;
  gVert?: number;
  tempFl: number;
  tempFr: number;
  tempRl: number;
  tempRr: number;
  slipAngleDelta: number; // understeer/oversteer delta
  tractionPct: number;
  suspTravelMin: number;
  lapNumber: number;
}

export interface LapRecord {
  lapNumber: number;
  lapTime: number;
  valid: boolean;
  deltaToBest?: number;
}

export interface ImpactEvent {
  timestamp: number;
  lapNumber: number;
  impactG: number;
  speedAtImpactMph: number;
  speedLostMph: number;
  corner: 'FL' | 'FR' | 'RL' | 'RR' | 'CHASSIS';
  severity: 'LIGHT' | 'MODERATE' | 'SEVERE';
  description: string;
}

export interface DrivingEvent {
  type: 'UNDERSTEER' | 'OVERSTEER' | 'WHEELSPIN' | 'LOCKUP' | 'BOTTOMING' | 'OVERHEATING' | 'WALL_IMPACT' | 'BARRIER_COLLISION' | 'JUMP_LANDING';
  timestamp: number;
  lapNumber: number;
  severity: number; // 0.0 - 1.0
  description: string;
  impactData?: ImpactEvent;
}

export interface DriftSummary {
  maxAngleDeg: number;
  maxAngleRad: number;
  timeInSlideSec: number;
  slidePct: number;
  rearTempRiseRate: number; // °F/s
  transitionCount: number;
  avgThrottleInSlide: number;
}

export interface SprintSummary {
  zeroToSixty: number;
  zeroToHundred: number;
  quarterMileTime: number;
  quarterMileTrap: number;
  launchWheelspinSec: number;
}

export interface OffroadSummary {
  jumpCount: number;
  maxAirTimeSec: number;
  maxLandingG: number;
  bottomingCount: number;
  roughnessIndex: number;
}

export interface CircuitSummary {
  bestLap: number;
  avgLap: number;
  consistencyScorePct: number;
  tireThermalSpread: number;
}

export interface Stint {
  id: string;
  name: string;
  createdAt: number;
  sessionMode: SessionMode;
  userSetMode?: boolean;
  carName: string;
  carOrdinal: number;
  carClass: string;
  carPi: number;
  drivetrain: string;
  totalDurationSeconds: number;
  totalDistanceMiles: number;
  totalLaps: number;
  bestLapTime: number;
  topSpeedMph: number;
  peakLatG: number;
  peakLonG: number;
  peakTireTemp: number;
  laps: LapRecord[];
  samples: TelemetrySample[];
  events: DrivingEvent[];
  impacts: ImpactEvent[];
  driftSummary?: DriftSummary;
  sprintSummary?: SprintSummary;
  offroadSummary?: OffroadSummary;
  circuitSummary?: CircuitSummary;
}

const DB_NAME = 'GridPulseDB';
const DB_VERSION = 2;
const STORE_NAME = 'stints';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('dyno_runs')) {
        db.createObjectStore('dyno_runs', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveStint(stint: Stint): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(stint);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllStints(): Promise<Stint[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const results: Stint[] = req.result || [];
      // Sort newest first
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getStintById(id: string): Promise<Stint | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteStint(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function exportStintToJson(stint: Stint): string {
  const exportPayload = {
    app: 'GridPulse',
    version: '2.2.0',
    exportTimestamp: new Date().toISOString(),
    stint: {
      id: stint.id,
      name: stint.name,
      createdAt: new Date(stint.createdAt).toISOString(),
      sessionMode: stint.sessionMode || 'FREE_ROAM',
      vehicle: {
        name: stint.carName,
        ordinal: stint.carOrdinal,
        class: stint.carClass,
        pi: stint.carPi,
        drivetrain: stint.drivetrain
      },
      summary: {
        durationSeconds: stint.totalDurationSeconds,
        distanceMiles: Number(stint.totalDistanceMiles.toFixed(2)),
        totalLaps: stint.totalLaps,
        bestLapTime: stint.bestLapTime,
        topSpeedMph: Math.round(stint.topSpeedMph),
        peakLatG: Number(stint.peakLatG.toFixed(2)),
        peakLonG: Number(stint.peakLonG.toFixed(2)),
        peakTireTemp: Math.round(stint.peakTireTemp)
      },
      modeSummaries: {
        drift: stint.driftSummary,
        sprint: stint.sprintSummary,
        offroad: stint.offroadSummary,
        circuit: stint.circuitSummary
      },
      impacts: stint.impacts || [],
      laps: stint.laps,
      events: stint.events,
      samplesCount: stint.samples.length,
      samples: stint.samples
    }
  };
  return JSON.stringify(exportPayload, null, 2);
}

export function downloadStintJsonFile(stint: Stint): void {
  const jsonStr = exportStintToJson(stint);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gridpulse_stint_${(stint.sessionMode || 'session').toLowerCase()}_${stint.carName.replace(/[^a-zA-Z0-9]/g, '_')}_${stint.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importStintFromJson(jsonString: string): Promise<Stint> {
  const parsed = JSON.parse(jsonString);
  const data = parsed.stint || parsed;
  if (!data.id || !data.samples) {
    throw new Error('Invalid GridPulse stint JSON format');
  }

  // Auto-detect mode if not present
  let detectedMode: SessionMode = data.sessionMode || 'FREE_ROAM';
  if (!data.sessionMode) {
    const maxSlip = Math.max(0, ...((data.samples || []) as TelemetrySample[]).map(s => Math.abs(s.slipAngleDelta || 0)));
    const wheelspins = ((data.events || []) as DrivingEvent[]).filter(e => e.type === 'WHEELSPIN').length;
    if (maxSlip > 0.6 || wheelspins >= 4) {
      detectedMode = 'DRIFT';
    } else if (data.laps && data.laps.length > 1) {
      detectedMode = 'CIRCUIT';
    } else if (data.summary?.bestLapTime > 0) {
      detectedMode = 'TIME_ATTACK';
    }
  }

  const stint: Stint = {
    id: data.id,
    name: data.name || `Imported Stint - ${data.vehicle?.name || 'Vehicle'}`,
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    sessionMode: detectedMode,
    carName: data.vehicle?.name || data.carName || 'Unknown Vehicle',
    carOrdinal: data.vehicle?.ordinal || data.carOrdinal || 0,
    carClass: data.vehicle?.class || data.carClass || 'S1',
    carPi: data.vehicle?.pi || data.carPi || 900,
    drivetrain: data.vehicle?.drivetrain || data.drivetrain || 'AWD',
    totalDurationSeconds: data.summary?.durationSeconds || data.totalDurationSeconds || 0,
    totalDistanceMiles: data.summary?.distanceMiles || data.totalDistanceMiles || 0,
    totalLaps: data.summary?.totalLaps || data.totalLaps || 0,
    bestLapTime: data.summary?.bestLapTime || data.bestLapTime || 0,
    topSpeedMph: data.summary?.topSpeedMph || data.topSpeedMph || 0,
    peakLatG: data.summary?.peakLatG || data.peakLatG || 0,
    peakLonG: data.summary?.peakLonG || data.peakLonG || 0,
    peakTireTemp: data.summary?.peakTireTemp || data.peakTireTemp || 0,
    laps: data.laps || [],
    samples: data.samples || [],
    events: data.events || [],
    impacts: data.impacts || data.events?.filter((e: any) => e.type === 'WALL_IMPACT').map((e: any) => e.impactData).filter(Boolean) || [],
    driftSummary: data.modeSummaries?.drift || data.driftSummary,
    sprintSummary: data.modeSummaries?.sprint || data.sprintSummary,
    offroadSummary: data.modeSummaries?.offroad || data.offroadSummary,
    circuitSummary: data.modeSummaries?.circuit || data.circuitSummary
  };
  await saveStint(stint);
  return stint;
}

/**
 * Live Stint Recorder
 * Captures ~5–10 Hz downsampled points during driving to maintain compact memory footprints.
 */
export class StintRecorder {
  private isRecording = false;
  private startTime = 0;
  private lastSampleTime = 0;
  private samples: TelemetrySample[] = [];
  private laps: Map<number, LapRecord> = new Map();
  private events: DrivingEvent[] = [];
  private impacts: ImpactEvent[] = [];
  private carInfo: { name: string; ordinal: number; class: string; pi: number; drivetrain: string } | null = null;
  private topSpeed = 0;
  private peakLat = 0;
  private peakLon = 0;
  private peakTemp = 0;
  private initialDistance = 0;
  private lastDistance = 0;
  private preferredMode: SessionMode | null = null;

  // Real-time impact tracking variables
  private lastSpeed = 0;
  private lastSpeedTime = 0;
  private rearTempStart = 0;
  private slideDuration = 0;
  private transitionCount = 0;
  private lastSteerSign = 0;
  private jumpAirTime = 0;
  private isAirborne = false;
  private jumpCount = 0;
  private maxLandingG = 0;
  private bottomingCount = 0;

  public start(
    carInfo: { name: string; ordinal: number; class: string; pi: number; drivetrain: string }, 
    currentDistance = 0,
    preferredMode: SessionMode | null = null
  ) {
    this.isRecording = true;
    this.startTime = Date.now();
    this.lastSampleTime = 0;
    this.samples = [];
    this.laps = new Map();
    this.events = [];
    this.impacts = [];
    this.carInfo = carInfo;
    this.topSpeed = 0;
    this.peakLat = 0;
    this.peakLon = 0;
    this.peakTemp = 0;
    this.initialDistance = currentDistance;
    this.lastDistance = currentDistance;
    this.preferredMode = preferredMode;

    this.lastSpeed = 0;
    this.lastSpeedTime = Date.now();
    this.rearTempStart = 0;
    this.slideDuration = 0;
    this.transitionCount = 0;
    this.lastSteerSign = 0;
    this.jumpAirTime = 0;
    this.isAirborne = false;
    this.jumpCount = 0;
    this.maxLandingG = 0;
    this.bottomingCount = 0;
  }

  public processFrame(telemetry: any) {
    if (!this.isRecording || !telemetry) return;

    const now = Date.now();
    const elapsedSec = (now - this.startTime) / 1000;
    this.lastDistance = telemetry.distance_traveled || this.lastDistance;

    const currentSpeed = telemetry.speed_mph || 0;
    const gX = Math.abs((telemetry.acceleration_x || 0) / 9.81);
    const gY = Math.abs((telemetry.acceleration_y || 0) / 9.81);
    const gZ = Math.abs((telemetry.acceleration_z || 0) / 9.81);
    const combinedG = Math.sqrt(gX * gX + gZ * gZ);

    // Track peak records
    if (currentSpeed > this.topSpeed) this.topSpeed = currentSpeed;
    if (gX > this.peakLat) this.peakLat = gX;
    if (gZ > this.peakLon) this.peakLon = gZ;

    const rearAvgTemp = ((telemetry.tire_temp_rl || 0) + (telemetry.tire_temp_rr || 0)) / 2;
    if (this.rearTempStart === 0) {
      this.rearTempStart = rearAvgTemp;
    }
    const maxT = Math.max(telemetry.tire_temp_fl || 0, telemetry.tire_temp_fr || 0, telemetry.tire_temp_rl || 0, telemetry.tire_temp_rr || 0);
    if (maxT > this.peakTemp) this.peakTemp = maxT;

    // Track completed laps
    if (telemetry.lap_number && telemetry.last_lap > 0) {
      if (!this.laps.has(telemetry.lap_number - 1)) {
        this.laps.set(telemetry.lap_number - 1, {
          lapNumber: telemetry.lap_number - 1,
          lapTime: telemetry.last_lap,
          valid: true
        });
      }
    }

    // =========================================================================
    // 1. PHYSICS-BASED WALL / BARRIER IMPACT DETECTION
    // =========================================================================
    const dt = (now - this.lastSpeedTime) / 1000;
    if (dt > 0.04 && dt < 0.25) {
      const dSpeed = this.lastSpeed - currentSpeed;
      const brake = Math.round(((telemetry.brake || 0) / 255) * 100);

      // Impact Signature: High G deceleration impulse or sudden speed drop with low brake pressure
      const isExtremeImpulse = combinedG >= 4.2;
      const isAbruptSpeedDrop = dSpeed >= 12 && brake < 50;

      if ((isExtremeImpulse || isAbruptSpeedDrop) && this.lastSpeed > 15) {
        const severity: ImpactEvent['severity'] = combinedG >= 8.0 || dSpeed >= 35 
          ? 'SEVERE' 
          : combinedG >= 5.5 || dSpeed >= 20 
          ? 'MODERATE' 
          : 'LIGHT';

        const impact: ImpactEvent = {
          timestamp: Number(elapsedSec.toFixed(2)),
          lapNumber: telemetry.lap_number || 1,
          impactG: Number(Math.max(combinedG, (dSpeed * 0.44704) / (dt * 9.81)).toFixed(1)),
          speedAtImpactMph: Math.round(this.lastSpeed),
          speedLostMph: Math.round(dSpeed),
          corner: gX > gZ ? (telemetry.steer > 0 ? 'FR' : 'FL') : 'CHASSIS',
          severity,
          description: `${severity} wall impact @ ${Math.round(this.lastSpeed)} MPH (${Number(combinedG.toFixed(1))}G force, -${Math.round(dSpeed)} MPH lost)`
        };

        // Debounce impacts within 1.5s
        const lastImpact = this.impacts[this.impacts.length - 1];
        if (!lastImpact || Math.abs(lastImpact.timestamp - impact.timestamp) > 1.5) {
          this.impacts.push(impact);
          this.events.push({
            type: 'WALL_IMPACT',
            timestamp: impact.timestamp,
            lapNumber: impact.lapNumber,
            severity: severity === 'SEVERE' ? 1.0 : severity === 'MODERATE' ? 0.7 : 0.4,
            description: impact.description,
            impactData: impact
          });
        }
      }
    }
    this.lastSpeed = currentSpeed;
    this.lastSpeedTime = now;

    // =========================================================================
    // 2. OFFROAD JUMP & AIRBORNE DETECTION
    // =========================================================================
    const suspMin = Math.min(telemetry.susp_fl ?? 1, telemetry.susp_fr ?? 1, telemetry.susp_rl ?? 1, telemetry.susp_rr ?? 1);
    const suspMax = Math.max(telemetry.susp_fl ?? 0, telemetry.susp_fr ?? 0, telemetry.susp_rl ?? 0, telemetry.susp_rr ?? 0);

    // Full droop on all 4 corners indicates airborne status
    if (suspMin > 0.85 && suspMax > 0.90 && currentSpeed > 25) {
      if (!this.isAirborne) {
        this.isAirborne = true;
        this.jumpAirTime = now;
      }
    } else if (this.isAirborne) {
      // Landing detected
      this.isAirborne = false;
      const airDurationSec = (now - this.jumpAirTime) / 1000;
      if (airDurationSec >= 0.25) {
        this.jumpCount++;
        const landingG = Number(gY.toFixed(1));
        if (gY > this.maxLandingG) this.maxLandingG = gY;
        this.addEventIfNew('JUMP_LANDING', Number(elapsedSec.toFixed(2)), telemetry.lap_number || 1, 0.7, `Jump landing (${airDurationSec.toFixed(2)}s airtime, ${landingG}G vert force)`);
      }
    }

    // =========================================================================
    // 3. DOWNSAMPLED TIME-SERIES LOGGING (10 Hz)
    // =========================================================================
    if (now - this.lastSampleTime >= 100) {
      this.lastSampleTime = now;

      const frontSlip = (Math.abs(telemetry.slip_angle_fl || 0) + Math.abs(telemetry.slip_angle_fr || 0)) / 2;
      const rearSlip = (Math.abs(telemetry.slip_angle_rl || 0) + Math.abs(telemetry.slip_angle_rr || 0)) / 2;
      const slipDelta = rearSlip - frontSlip;

      // Track drift transitions
      const steerVal = telemetry.steer || 0;
      const steerSign = steerVal > 20 ? 1 : steerVal < -20 ? -1 : 0;
      if (steerSign !== 0 && this.lastSteerSign !== 0 && steerSign !== this.lastSteerSign && Math.abs(slipDelta) > 0.3) {
        this.transitionCount++;
      }
      if (steerSign !== 0) this.lastSteerSign = steerSign;

      if (Math.abs(slipDelta) > 0.25) {
        this.slideDuration += 0.1;
      }

      const sample: TelemetrySample = {
        t: Number(elapsedSec.toFixed(2)),
        speedMph: Math.round(currentSpeed),
        speedKph: Math.round(telemetry.speed_kph || 0),
        rpm: Math.round(telemetry.current_engine_rpm || 0),
        gear: telemetry.gear || 0,
        throttle: Math.round(((telemetry.accel || 0) / 255) * 100),
        brake: Math.round(((telemetry.brake || 0) / 255) * 100),
        steer: telemetry.steer || 0,
        gLat: Number(gX.toFixed(2)),
        gLon: Number(gZ.toFixed(2)),
        gVert: Number(gY.toFixed(2)),
        tempFl: Math.round(telemetry.tire_temp_fl || 0),
        tempFr: Math.round(telemetry.tire_temp_fr || 0),
        tempRl: Math.round(telemetry.tire_temp_rl || 0),
        tempRr: Math.round(telemetry.tire_temp_rr || 0),
        slipAngleDelta: Number(slipDelta.toFixed(3)),
        tractionPct: Math.min(100, Math.round((combinedG / 2.4) * 100)),
        suspTravelMin: Number(suspMin.toFixed(3)),
        lapNumber: telemetry.lap_number || 1
      };

      this.samples.push(sample);

      // Driving Event Triggers
      if (sample.throttle > 70 && (Math.abs(telemetry.tire_slip_fl || 0) > 1.2 || Math.abs(telemetry.tire_slip_rl || 0) > 1.2)) {
        this.addEventIfNew('WHEELSPIN', sample.t, sample.lapNumber, 0.8, 'Power wheelspin detected');
      }
      if (sample.brake > 80 && (Math.abs(telemetry.tire_slip_fl || 0) > 1.3 || Math.abs(telemetry.tire_slip_rl || 0) > 1.3)) {
        this.addEventIfNew('LOCKUP', sample.t, sample.lapNumber, 0.9, 'Axle brake lockup detected');
      }
      if (sample.suspTravelMin < 0.04) {
        this.bottomingCount++;
        this.addEventIfNew('BOTTOMING', sample.t, sample.lapNumber, 1.0, 'Suspension bump-stop compression');
      }
    }
  }

  private addEventIfNew(type: DrivingEvent['type'], t: number, lap: number, severity: number, desc: string) {
    const last = this.events[this.events.length - 1];
    if (!last || last.type !== type || Math.abs(last.timestamp - t) > 2.5) {
      this.events.push({
        type,
        timestamp: t,
        lapNumber: lap,
        severity,
        description: desc
      });
    }
  }

  public async stop(): Promise<Stint | null> {
    if (!this.isRecording || !this.carInfo) return null;
    this.isRecording = false;

    const totalDuration = (Date.now() - this.startTime) / 1000;
    const distanceMeters = Math.max(0, this.lastDistance - this.initialDistance);
    const distanceMiles = distanceMeters * 0.000621371;

    const lapsList = Array.from(this.laps.values());
    const bestLap = lapsList.length > 0 ? Math.min(...lapsList.map(l => l.lapTime)) : 0;

    // =========================================================================
    // 4. STYLE-SPECIFIC SUMMARY CALCULATIONS
    // =========================================================================
    const maxSlipRad = Math.max(0, ...this.samples.map(s => Math.abs(s.slipAngleDelta || 0)));
    const maxSlipDeg = Math.round(maxSlipRad * (180 / Math.PI));
    const slidePct = totalDuration > 0 ? Math.min(100, Math.round((this.slideDuration / totalDuration) * 100)) : 0;
    
    // Rear temperature rise rate
    const rearTempDelta = Math.max(0, this.peakTemp - (this.rearTempStart || 100));
    const rearTempRiseRate = totalDuration > 0 ? Number((rearTempDelta / totalDuration).toFixed(2)) : 0;

    const slideSamples = this.samples.filter(s => Math.abs(s.slipAngleDelta) > 0.25);
    const avgThrottleInSlide = slideSamples.length > 0 
      ? Math.round(slideSamples.reduce((acc, s) => acc + s.throttle, 0) / slideSamples.length) 
      : 0;

    const driftSummary: DriftSummary = {
      maxAngleDeg: maxSlipDeg,
      maxAngleRad: Number(maxSlipRad.toFixed(2)),
      timeInSlideSec: Number(this.slideDuration.toFixed(1)),
      slidePct,
      rearTempRiseRate,
      transitionCount: this.transitionCount,
      avgThrottleInSlide
    };

    const offroadSummary: OffroadSummary = {
      jumpCount: this.jumpCount,
      maxAirTimeSec: Number(this.maxLandingG.toFixed(2)),
      maxLandingG: Number(this.maxLandingG.toFixed(2)),
      bottomingCount: this.bottomingCount,
      roughnessIndex: Math.min(100, Math.round(this.bottomingCount * 10 + this.jumpCount * 15))
    };

    const avgLap = lapsList.length > 0 
      ? lapsList.reduce((a, b) => a + b.lapTime, 0) / lapsList.length 
      : 0;
    const lapVariance = lapsList.length > 1 
      ? Math.sqrt(lapsList.reduce((acc, l) => acc + Math.pow(l.lapTime - avgLap, 2), 0) / lapsList.length) 
      : 0;
    const consistencyScorePct = lapsList.length > 1 
      ? Math.max(50, Math.min(100, Math.round(100 - (lapVariance / avgLap) * 100))) 
      : 100;

    const circuitSummary: CircuitSummary = {
      bestLap,
      avgLap: Number(avgLap.toFixed(3)),
      consistencyScorePct,
      tireThermalSpread: Math.round(this.peakTemp - 120)
    };

    // =========================================================================
    // 5. SESSION MODE AUTO-CLASSIFIER
    // =========================================================================
    let detectedMode: SessionMode = this.preferredMode || 'FREE_ROAM';
    if (!this.preferredMode) {
      const wheelspinEvents = this.events.filter(e => e.type === 'WHEELSPIN').length;
      if (maxSlipRad > 0.5 || slidePct > 20 || wheelspinEvents >= 4) {
        detectedMode = 'DRIFT';
      } else if (this.jumpCount >= 2 || this.bottomingCount >= 4) {
        detectedMode = 'OFFROAD';
      } else if (lapsList.length >= 2) {
        detectedMode = 'CIRCUIT';
      } else if (bestLap > 0) {
        detectedMode = 'TIME_ATTACK';
      } else if (totalDuration < 35 && this.topSpeed > 70) {
        detectedMode = 'SPRINT';
      } else {
        detectedMode = 'FREE_ROAM';
      }
    }

    const stint: Stint = {
      id: `stint-${Date.now()}`,
      name: `Stint ${new Date().toLocaleTimeString()} - ${this.carInfo.name} (${detectedMode})`,
      createdAt: Date.now(),
      sessionMode: detectedMode,
      userSetMode: !!this.preferredMode,
      carName: this.carInfo.name,
      carOrdinal: this.carInfo.ordinal,
      carClass: this.carInfo.class,
      carPi: this.carInfo.pi,
      drivetrain: this.carInfo.drivetrain,
      totalDurationSeconds: Math.round(totalDuration),
      totalDistanceMiles: Number(distanceMiles.toFixed(2)),
      totalLaps: Math.max(1, lapsList.length),
      bestLapTime: bestLap,
      topSpeedMph: Math.round(this.topSpeed),
      peakLatG: Number(this.peakLat.toFixed(2)),
      peakLonG: Number(this.peakLon.toFixed(2)),
      peakTireTemp: Math.round(this.peakTemp),
      laps: lapsList,
      samples: this.samples,
      events: this.events,
      impacts: this.impacts,
      driftSummary,
      offroadSummary,
      circuitSummary
    };

    await saveStint(stint);
    return stint;
  }

  public getActiveDuration(): number {
    return this.isRecording ? (Date.now() - this.startTime) / 1000 : 0;
  }

  public getSampleCount(): number {
    return this.samples.length;
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }
}

export const globalStintRecorder = new StintRecorder();
