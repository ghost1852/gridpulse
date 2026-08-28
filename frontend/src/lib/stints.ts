/**
 * GridPulse Local-First Stint & Telemetry Recording Engine
 * Stores full session telemetry stints directly into browser IndexedDB.
 * Zero cloud storage, 100% offline persistence, AI-ready JSON export.
 */

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

export interface DrivingEvent {
  type: 'UNDERSTEER' | 'OVERSTEER' | 'WHEELSPIN' | 'LOCKUP' | 'BOTTOMING' | 'OVERHEATING';
  timestamp: number;
  lapNumber: number;
  severity: number; // 0.0 - 1.0
  description: string;
}

export interface Stint {
  id: string;
  name: string;
  createdAt: number;
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
}

const DB_NAME = 'GridPulseDB';
const DB_VERSION = 1;
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
    version: '2.1.0',
    exportTimestamp: new Date().toISOString(),
    stint: {
      id: stint.id,
      name: stint.name,
      createdAt: new Date(stint.createdAt).toISOString(),
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
  a.download = `gridpulse_stint_${stint.carName.replace(/[^a-zA-Z0-9]/g, '_')}_${stint.id}.json`;
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
  const stint: Stint = {
    id: data.id,
    name: data.name || `Imported Stint - ${data.vehicle?.name || 'Vehicle'}`,
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
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
    events: data.events || []
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
  private carInfo: { name: string; ordinal: number; class: string; pi: number; drivetrain: string } | null = null;
  private topSpeed = 0;
  private peakLat = 0;
  private peakLon = 0;
  private peakTemp = 0;
  private initialDistance = 0;
  private lastDistance = 0;

  public start(carInfo: { name: string; ordinal: number; class: string; pi: number; drivetrain: string }, currentDistance = 0) {
    this.isRecording = true;
    this.startTime = Date.now();
    this.lastSampleTime = 0;
    this.samples = [];
    this.laps = new Map();
    this.events = [];
    this.carInfo = carInfo;
    this.topSpeed = 0;
    this.peakLat = 0;
    this.peakLon = 0;
    this.peakTemp = 0;
    this.initialDistance = currentDistance;
    this.lastDistance = currentDistance;
  }

  public processFrame(telemetry: any) {
    if (!this.isRecording || !telemetry) return;

    const now = Date.now();
    const elapsedSec = (now - this.startTime) / 1000;
    this.lastDistance = telemetry.distance_traveled || this.lastDistance;

    // Track peak records
    if (telemetry.speed_mph > this.topSpeed) this.topSpeed = telemetry.speed_mph;
    const gX = Math.abs((telemetry.acceleration_x || 0) / 9.81);
    const gZ = Math.abs((telemetry.acceleration_z || 0) / 9.81);
    if (gX > this.peakLat) this.peakLat = gX;
    if (gZ > this.peakLon) this.peakLon = gZ;

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

    // Downsample to 10 Hz (every 100ms) for time-series charts
    if (now - this.lastSampleTime >= 100) {
      this.lastSampleTime = now;

      const frontSlip = (Math.abs(telemetry.slip_angle_fl || 0) + Math.abs(telemetry.slip_angle_fr || 0)) / 2;
      const rearSlip = (Math.abs(telemetry.slip_angle_rl || 0) + Math.abs(telemetry.slip_angle_rr || 0)) / 2;
      const slipDelta = rearSlip - frontSlip;

      const minSusp = Math.min(telemetry.susp_fl ?? 1, telemetry.susp_fr ?? 1, telemetry.susp_rl ?? 1, telemetry.susp_rr ?? 1);

      const sample: TelemetrySample = {
        t: Number(elapsedSec.toFixed(2)),
        speedMph: Math.round(telemetry.speed_mph || 0),
        speedKph: Math.round(telemetry.speed_kph || 0),
        rpm: Math.round(telemetry.current_engine_rpm || 0),
        gear: telemetry.gear || 0,
        throttle: Math.round(((telemetry.accel || 0) / 255) * 100),
        brake: Math.round(((telemetry.brake || 0) / 255) * 100),
        steer: telemetry.steer || 0,
        gLat: Number(gX.toFixed(2)),
        gLon: Number(gZ.toFixed(2)),
        tempFl: Math.round(telemetry.tire_temp_fl || 0),
        tempFr: Math.round(telemetry.tire_temp_fr || 0),
        tempRl: Math.round(telemetry.tire_temp_rl || 0),
        tempRr: Math.round(telemetry.tire_temp_rr || 0),
        slipAngleDelta: Number(slipDelta.toFixed(3)),
        tractionPct: Math.min(100, Math.round((Math.sqrt(gX * gX + gZ * gZ) / 2.4) * 100)),
        suspTravelMin: Number(minSusp.toFixed(3)),
        lapNumber: telemetry.lap_number || 1
      };

      this.samples.push(sample);

      // Event detection triggers
      if (sample.throttle > 70 && (Math.abs(telemetry.tire_slip_fl || 0) > 1.2 || Math.abs(telemetry.tire_slip_rl || 0) > 1.2)) {
        this.addEventIfNew('WHEELSPIN', sample.t, sample.lapNumber, 0.8, 'Power wheelspin detected');
      }
      if (sample.brake > 80 && (Math.abs(telemetry.tire_slip_fl || 0) > 1.3 || Math.abs(telemetry.tire_slip_rl || 0) > 1.3)) {
        this.addEventIfNew('LOCKUP', sample.t, sample.lapNumber, 0.9, 'Axle brake lockup detected');
      }
      if (sample.suspTravelMin < 0.04) {
        this.addEventIfNew('BOTTOMING', sample.t, sample.lapNumber, 1.0, 'Suspension bump-stop compression');
      }
    }
  }

  private addEventIfNew(type: DrivingEvent['type'], t: number, lap: number, severity: number, desc: string) {
    const last = this.events[this.events.length - 1];
    // Debounce similar events within 2.5 seconds
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

    const stint: Stint = {
      id: `stint-${Date.now()}`,
      name: `Stint ${new Date().toLocaleTimeString()} - ${this.carInfo.name}`,
      createdAt: Date.now(),
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
      events: this.events
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
