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
  suspFl?: number; // 0-1 normalized suspension travel
  suspFr?: number;
  suspRl?: number;
  suspRr?: number;
  suspTravelMin: number;
  slipAngleDelta: number; // understeer/oversteer delta
  tractionPct: number;
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
  type: 'UNDERSTEER' | 'OVERSTEER' | 'WHEELSPIN' | 'LOCKUP' | 'BOTTOMING' | 'OVERHEATING' | 'WALL_IMPACT' | 'BARRIER_COLLISION' | 'JUMP_LANDING' | 'REWIND_DETECTED';
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
  qualityFlags?: string[];
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

  // Ground distance integration
  private groundDistanceMeters = 0;
  private lastSpeedTime = 0;

  // Real-time impact & lap tracking
  private lastSpeed = 0;
  private rearTempStart = 0;
  private slideDuration = 0;
  private transitionCount = 0;
  private lastSteerSign = 0;
  private jumpAirTime = 0;
  private isAirborne = false;
  private jumpCount = 0;
  private maxLandingG = 0;
  private bottomingCount = 0;
  private lastCurrentLap = 0;
  private lastLapNumber = 1;
  private lastCurrentRaceTime = 0;
  private lastTimestampMS = 0;
  private wasRewound = false;

  // Virtual GPS Timing Gate & Lap Engine (LapScope / fh6-tel pattern)
  private gatePosition: { x: number; y: number; z: number } | null = null;
  private gateHeading: { x: number; z: number } | null = null;
  private gateArmTime = 0;
  private gateArmDistance = 0;
  private currentLapStartTime = 0;
  private virtualLapIndex = 1;
  private activeMovingTime = 0;
  private launchDetected = false;

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

    this.groundDistanceMeters = 0;
    this.lastSpeedTime = Date.now();
    this.lastSpeed = 0;
    this.rearTempStart = 0;
    this.slideDuration = 0;
    this.transitionCount = 0;
    this.lastSteerSign = 0;
    this.jumpAirTime = 0;
    this.isAirborne = false;
    this.jumpCount = 0;
    this.maxLandingG = 0;
    this.bottomingCount = 0;
    this.lastCurrentLap = 0;
    this.lastLapNumber = 1;
    this.lastCurrentRaceTime = 0;
    this.lastTimestampMS = 0;
    this.wasRewound = false;

    this.gatePosition = null;
    this.gateHeading = null;
    this.gateArmTime = 0;
    this.gateArmDistance = 0;
    this.currentLapStartTime = 0;
    this.virtualLapIndex = 1;
    this.activeMovingTime = 0;
    this.launchDetected = false;
  }

  public getActiveDuration(): number {
    if (!this.isRecording || this.startTime === 0) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  public getSamplesCount(): number {
    return this.samples.length;
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

    // Track ground distance integration using true linear speed
    const dt = this.lastSpeedTime > 0 ? (now - this.lastSpeedTime) / 1000 : 0;
    if (dt > 0.005 && dt < 0.5) {
      if (currentSpeed > 0.5) {
        this.groundDistanceMeters += (currentSpeed * 0.44704) * dt;
        this.activeMovingTime += dt;
      }
    }

    // Launch detection
    if (!this.launchDetected && currentSpeed > 3 && (telemetry.accel || 0) > 60) {
      this.launchDetected = true;
      if (this.currentLapStartTime === 0) {
        this.currentLapStartTime = elapsedSec;
      }
    }

    // =========================================================================
    // 1. REWIND DETECTION (fh6-tel pattern)
    // =========================================================================
    const ts = telemetry.timestamp_ms || 0;
    const raceTime = telemetry.current_race_time || 0;
    const dist = telemetry.distance_traveled || 0;

    if ((this.lastTimestampMS > 0 && ts > 0 && ts < this.lastTimestampMS - 250) || 
        (this.lastCurrentRaceTime > 0 && raceTime > 0 && raceTime < this.lastCurrentRaceTime - 0.5) ||
        (this.lastDistance > 0 && dist > 0 && dist < this.lastDistance - 5)) {
      this.wasRewound = true;
      this.events.push({
        type: 'REWIND_DETECTED',
        timestamp: Number(elapsedSec.toFixed(2)),
        lapNumber: telemetry.lap_number || 1,
        severity: 0.6,
        description: `Rewind detected @ ${Math.round(currentSpeed)} MPH. Lap flagged as dirty.`
      });
    }
    this.lastTimestampMS = ts;
    this.lastCurrentRaceTime = raceTime;

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

    // =========================================================================
    // 2. LAP TRACKING: IN-GAME OFFICIAL LAPS vs VIRTUAL GPS GATES
    // =========================================================================
    const currentLapTime = telemetry.current_lap || 0;
    const lastLapTime = telemetry.last_lap || 0;
    const lapNum = telemetry.lap_number || 1;

    // A. Game provided last_lap on official circuit transition
    if (lastLapTime > 0 && lapNum > 1) {
      const completedLapIndex = lapNum - 1;
      if (!this.laps.has(completedLapIndex) || this.laps.get(completedLapIndex)?.lapTime !== lastLapTime) {
        this.laps.set(completedLapIndex, {
          lapNumber: completedLapIndex,
          lapTime: Number(lastLapTime.toFixed(3)),
          valid: !this.wasRewound
        });
        this.wasRewound = false;
      }
    }

    // B. Lap number increased or in-game currentLap timer reset
    if (this.lastLapNumber > 0 && lapNum > this.lastLapNumber && this.lastCurrentLap > 5) {
      const completedLap = this.lastLapNumber;
      if (!this.laps.has(completedLap)) {
        this.laps.set(completedLap, {
          lapNumber: completedLap,
          lapTime: Number((lastLapTime > 0 ? lastLapTime : this.lastCurrentLap).toFixed(3)),
          valid: !this.wasRewound
        });
        this.wasRewound = false;
      }
    } else if (this.lastCurrentLap > 15 && currentLapTime < 2 && currentLapTime > 0) {
      const completedLap = this.laps.size + 1;
      if (!this.laps.has(completedLap)) {
        this.laps.set(completedLap, {
          lapNumber: completedLap,
          lapTime: Number(this.lastCurrentLap.toFixed(3)),
          valid: !this.wasRewound
        });
        this.wasRewound = false;
      }
    }
    this.lastCurrentLap = currentLapTime;
    this.lastLapNumber = lapNum;

    // C. Virtual GPS Start/Finish Gate (LapScope Closed Circuit Loops in Free Roam)
    const posX = telemetry.position_x ?? telemetry.PositionX;
    const posY = telemetry.position_y ?? telemetry.PositionY;
    const posZ = telemetry.position_z ?? telemetry.PositionZ;

    if (posX !== undefined && posZ !== undefined && (posX !== 0 || posZ !== 0)) {
      if (!this.gatePosition && currentSpeed > 8) {
        this.gatePosition = { x: posX, y: posY || 0, z: posZ };
        const velX = telemetry.velocity_x || 0;
        const velZ = telemetry.velocity_z || 1;
        const mag = Math.sqrt(velX * velX + velZ * velZ) || 1;
        this.gateHeading = { x: velX / mag, z: velZ / mag };
        this.gateArmTime = elapsedSec + 15;
        this.gateArmDistance = this.groundDistanceMeters + 300;
        this.currentLapStartTime = elapsedSec;
      }

      if (this.gatePosition && elapsedSec >= this.gateArmTime && this.groundDistanceMeters >= this.gateArmDistance) {
        const dx = posX - this.gatePosition.x;
        const dz = posZ - this.gatePosition.z;
        const distToGate = Math.sqrt(dx * dx + dz * dz);

        const velX = telemetry.velocity_x || 0;
        const velZ = telemetry.velocity_z || 1;
        const mag = Math.sqrt(velX * velX + velZ * velZ) || 1;
        const headingDot = this.gateHeading ? (velX / mag) * this.gateHeading.x + (velZ / mag) * this.gateHeading.z : 1;

        if (distToGate <= 22 && headingDot > 0.40 && currentSpeed > 12) {
          const virtualLapTime = Number((elapsedSec - this.currentLapStartTime).toFixed(3));
          if (virtualLapTime > 15) {
            const lapIdx = this.virtualLapIndex++;
            this.laps.set(lapIdx, {
              lapNumber: lapIdx,
              lapTime: virtualLapTime,
              valid: !this.wasRewound
            });
            this.gateArmTime = elapsedSec + 15;
            this.gateArmDistance = this.groundDistanceMeters + 300;
            this.currentLapStartTime = elapsedSec;
            this.wasRewound = false;
          }
        }
      }
    }

    // =========================================================================
    // 1. PHYSICS-BASED WALL / BARRIER IMPACT DETECTION
    // =========================================================================
    if (dt > 0.04 && dt < 0.25) {
      const dSpeed = this.lastSpeed - currentSpeed;
      const brake = Math.round(((telemetry.brake || 0) / 255) * 100);

      const isExtremeImpulse = combinedG >= 4.2;
      const isAbruptSpeedDrop = dSpeed >= 14 && brake < 45;

      if ((isExtremeImpulse || isAbruptSpeedDrop) && this.lastSpeed > 20) {
        const severity: ImpactEvent['severity'] = combinedG >= 8.0 || dSpeed >= 35 
          ? 'SEVERE' 
          : combinedG >= 5.5 || dSpeed >= 20 
          ? 'MODERATE' 
          : 'LIGHT';

        const impact: ImpactEvent = {
          timestamp: Number(elapsedSec.toFixed(2)),
          lapNumber: lapNum,
          impactG: Number(Math.max(combinedG, (dSpeed * 0.44704) / (dt * 9.81)).toFixed(1)),
          speedAtImpactMph: Math.round(this.lastSpeed),
          speedLostMph: Math.round(dSpeed),
          corner: gX > gZ ? (telemetry.steer > 0 ? 'FR' : 'FL') : 'CHASSIS',
          severity,
          description: `${severity} wall impact @ ${Math.round(this.lastSpeed)} MPH (${Number(combinedG.toFixed(1))}G force, -${Math.round(dSpeed)} MPH lost)`
        };

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

    // Suspension Values (Normalized: 0.0 = full bump/bottom, 1.0 = full droop/airborne)
    const suspFl = Number((telemetry.susp_fl ?? 0.5).toFixed(3));
    const suspFr = Number((telemetry.susp_fr ?? 0.5).toFixed(3));
    const suspRl = Number((telemetry.susp_rl ?? 0.5).toFixed(3));
    const suspRr = Number((telemetry.susp_rr ?? 0.5).toFixed(3));
    const suspMin = Math.min(suspFl, suspFr, suspRl, suspRr);
    const suspMax = Math.max(suspFl, suspFr, suspRl, suspRr);

    // Airborne / Jump Detection
    if (suspMin > 0.85 && suspMax > 0.90 && currentSpeed > 25) {
      if (!this.isAirborne) {
        this.isAirborne = true;
        this.jumpAirTime = now;
      }
    } else if (this.isAirborne) {
      this.isAirborne = false;
      const airDurationSec = (now - this.jumpAirTime) / 1000;
      if (airDurationSec >= 0.25) {
        this.jumpCount++;
        const landingG = Number(gY.toFixed(1));
        if (gY > this.maxLandingG) this.maxLandingG = gY;
        this.addEventIfNew('JUMP_LANDING', Number(elapsedSec.toFixed(2)), lapNum, 0.7, `Jump landing (${airDurationSec.toFixed(2)}s airtime, ${landingG}G vert force)`);
      }
    }

    // Downsampled Time-Series Logging (10 Hz)
    if (now - this.lastSampleTime >= 100) {
      this.lastSampleTime = now;

      const frontSlip = (Math.abs(telemetry.slip_angle_fl || 0) + Math.abs(telemetry.slip_angle_fr || 0)) / 2;
      const rearSlip = (Math.abs(telemetry.slip_angle_rl || 0) + Math.abs(telemetry.slip_angle_rr || 0)) / 2;
      const slipDelta = rearSlip - frontSlip;

      // Track controlled drift transitions
      const steerVal = telemetry.steer || 0;
      const steerSign = steerVal > 20 ? 1 : steerVal < -20 ? -1 : 0;
      if (steerSign !== 0 && this.lastSteerSign !== 0 && steerSign !== this.lastSteerSign && Math.abs(slipDelta) > 0.35) {
        this.transitionCount++;
      }
      if (steerSign !== 0) this.lastSteerSign = steerSign;

      // Track slide duration (> 20 MPH and sustained slipDelta > 0.35 rad / 20 deg)
      if (currentSpeed > 20 && Math.abs(slipDelta) > 0.35 && Math.abs(slipDelta) < 1.4) {
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
        suspFl,
        suspFr,
        suspRl,
        suspRr,
        suspTravelMin: Number(suspMin.toFixed(3)),
        slipAngleDelta: Number(slipDelta.toFixed(3)),
        tractionPct: Math.min(100, Math.round((combinedG / 2.4) * 100)),
        lapNumber: lapNum
      };

      this.samples.push(sample);

      // Bottoming Strikes (check each corner specifically)
      if (suspMin < 0.05) {
        this.bottomingCount++;
        const corner = suspFl < 0.05 ? 'FL' : suspFr < 0.05 ? 'FR' : suspRl < 0.05 ? 'RL' : 'RR';
        this.addEventIfNew('BOTTOMING', sample.t, sample.lapNumber, 1.0, `${corner} suspension bump-stop strike (${Math.round(suspMin * 100)}% remaining)`);
      }

      // Wheelspin: Only true severe drive axle slip, not normal acceleration slip
      const rearSlipRatio = Math.max(Math.abs(telemetry.tire_slip_rl || 0), Math.abs(telemetry.tire_slip_rr || 0));
      const frontSlipRatio = Math.max(Math.abs(telemetry.tire_slip_fl || 0), Math.abs(telemetry.tire_slip_fr || 0));
      const driveAxleSlip = this.carInfo?.drivetrain === 'FWD' ? frontSlipRatio : rearSlipRatio;

      if (sample.throttle > 70 && driveAxleSlip > 2.5 && currentSpeed > 5) {
        this.addEventIfNew('WHEELSPIN', sample.t, sample.lapNumber, 0.7, 'Severe drive-axle wheelspin');
      }

      // Lockup
      const maxSlipRatio = Math.max(rearSlipRatio, frontSlipRatio);
      if (sample.brake > 75 && maxSlipRatio > 2.8 && currentSpeed > 10) {
        this.addEventIfNew('LOCKUP', sample.t, sample.lapNumber, 0.8, 'Axle brake lockup detected');
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
    
    // Accurate ground distance
    const rawGameMeters = Math.max(0, this.lastDistance - this.initialDistance);
    const finalDistanceMeters = this.groundDistanceMeters > 0 ? this.groundDistanceMeters : rawGameMeters;
    const distanceMiles = finalDistanceMeters * 0.000621371;

    // Derived style calculations
    const slideSamples = this.samples.filter(s => s.speedMph > 20 && Math.abs(s.slipAngleDelta) >= 0.20 && Math.abs(s.slipAngleDelta) <= 1.35);
    const maxSlipRad = slideSamples.length > 0 ? Math.max(...slideSamples.map(s => Math.abs(s.slipAngleDelta))) : 0;
    const maxSlipDeg = Math.round(maxSlipRad * (180 / Math.PI));
    const slidePct = totalDuration > 0 ? Math.min(100, Math.round((this.slideDuration / totalDuration) * 100)) : 0;

    const rearTempDelta = Math.max(0, this.peakTemp - (this.rearTempStart || 100));
    const rearTempRiseRate = totalDuration > 0 ? Number((rearTempDelta / totalDuration).toFixed(2)) : 0;
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

    // Mode Detection: Preferred Mode ALWAYS wins if set by user!
    let detectedMode: SessionMode = this.preferredMode || 'FREE_ROAM';
    if (!this.preferredMode) {
      const avgSpeedMph = totalDuration > 0 ? (distanceMiles / (totalDuration / 3600)) : 0;
      const isIntentionalDrift = (driftSummary.timeInSlideSec >= 4.0 && driftSummary.slidePct >= 35 && driftSummary.transitionCount >= 3 && maxSlipDeg >= 22);

      if (isIntentionalDrift) {
        detectedMode = 'DRIFT';
      } else if (this.jumpCount >= 2 || (this.jumpCount >= 1 && this.bottomingCount >= 3)) {
        detectedMode = 'OFFROAD';
      } else if (this.laps.size >= 2) {
        detectedMode = 'CIRCUIT';
      } else if (this.laps.size === 1 || avgSpeedMph > 45) {
        detectedMode = 'TIME_ATTACK';
      } else if (totalDuration < 35 && this.topSpeed > 75) {
        detectedMode = 'SPRINT';
      } else {
        detectedMode = 'FREE_ROAM';
      }
    }

    const lapsList = Array.from(this.laps.values());

    // Point-to-Point Time Attack & Sprints (open road run with no loop gates)
    if (lapsList.length === 0 && (detectedMode === 'TIME_ATTACK' || detectedMode === 'SPRINT') && totalDuration >= 8) {
      const hotLapTime = Number((this.activeMovingTime > 5 ? this.activeMovingTime : totalDuration).toFixed(3));
      const hotLap: LapRecord = {
        lapNumber: 1,
        lapTime: hotLapTime,
        valid: !this.wasRewound
      };
      lapsList.push(hotLap);
    }

    const hasRecordedLaps = lapsList.length > 0;
    const bestLap = hasRecordedLaps ? Math.min(...lapsList.map(l => l.lapTime)) : 0;

    const avgLap = hasRecordedLaps 
      ? lapsList.reduce((a, b) => a + b.lapTime, 0) / lapsList.length 
      : 0;
    const lapVariance = lapsList.length > 1 
      ? Math.sqrt(lapsList.reduce((acc, l) => acc + Math.pow(l.lapTime - avgLap, 2), 0) / lapsList.length) 
      : 0;
    const consistencyScorePct = lapsList.length > 1 
      ? Math.max(50, Math.min(100, Math.round(100 - (lapVariance / avgLap) * 100))) 
      : (hasRecordedLaps ? 100 : 0);

    const circuitSummary: CircuitSummary = {
      bestLap,
      avgLap: Number(avgLap.toFixed(3)),
      consistencyScorePct,
      tireThermalSpread: Math.max(0, Math.round(this.peakTemp - 120))
    };

    const qualityFlags: string[] = [];
    if (!hasRecordedLaps) qualityFlags.push('NO_IN_GAME_LAPS');

    const stint: Stint = {
      id: `stint-${Date.now()}`,
      name: `Stint ${new Date().toLocaleTimeString()} - ${this.carInfo.name} (${detectedMode})`,
      createdAt: Date.now(),
      sessionMode: detectedMode,
      userSetMode: !!this.preferredMode,
      qualityFlags,
      carName: this.carInfo.name,
      carOrdinal: this.carInfo.ordinal,
      carClass: this.carInfo.class,
      carPi: this.carInfo.pi,
      drivetrain: this.carInfo.drivetrain,
      totalDurationSeconds: Math.round(totalDuration),
      totalDistanceMiles: Number(distanceMiles.toFixed(2)),
      totalLaps: lapsList.length,
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

  public getIsRecording(): boolean {
    return this.isRecording;
  }
}

export const globalStintRecorder = new StintRecorder();
