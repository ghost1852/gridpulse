/**
 * GridPulse — Spatial Lap Inference & Vehicle-Motion State Engine
 * Engineered for sub-millisecond start/finish plane crossings,
 * vehicle-motion state machine, rewind detection, and sub-frame temporal interpolation.
 */

export interface SpatialGate {
  position: { x: number; y: number; z: number };
  normal: { x: number; z: number }; // Unit vector in forward track direction
  widthMeters: number;
  createdAt: number;
}

export interface TrajectoryPoint {
  distanceMeters: number;
  timeSec: number;
  speedMph: number;
}

export interface LapRecord {
  lapNumber: number;
  lapTime: number;
  startTime: number;
  endTime: number;
  startDistance: number;
  endDistance: number;
  topSpeedMph: number;
  valid: boolean;
  dirtyReason?: 'REWIND' | 'OFF_TRACK' | 'INCOMPLETE';
  trajectory?: TrajectoryPoint[];
}

export type MotionState = 'IDLE' | 'STAGING' | 'RUNNING' | 'ARMED' | 'REWOUND';

export function playGateChime(type: 'set' | 'lap' | 'armed') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'set') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } else if (type === 'lap') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    }
  } catch {}

  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 30, 40]);
    }
  } catch {}
}

export class LapInferenceEngine {
  private gate: SpatialGate | null = null;
  private lastPos: { x: number; y: number; z: number } | null = null;
  private lastTime = 0;
  private lastTimestampMs = 0;

  private state: MotionState = 'IDLE';
  private currentLapIndex = 1;
  private lapStartTime = 0;
  private lapStartDistance = 0;
  private distanceTraveled = 0;
  private lapTopSpeed = 0;
  private isLapDirty = false;
  private dirtyReason?: 'REWIND' | 'OFF_TRACK';

  private activeLapTrajectory: TrajectoryPoint[] = [];
  private bestLapTrajectory: TrajectoryPoint[] = [];
  private completedLaps: LapRecord[] = [];
  private minLapDurationSec = 12.0; // Minimum plausible lap time to prevent double-cross
  private minLapDistanceMeters = 200.0; // Minimum circuit distance to arm finish gate

  constructor() {
    this.loadSavedGate();
  }

  private loadSavedGate() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('gp_custom_sf_gate');
        if (saved) {
          this.gate = JSON.parse(saved);
        }
      }
    } catch {}
  }

  public setCustomGate(x: number, y: number, z: number, vx = 0, vz = 0, yaw = 0, width = 30.0) {
    let nx = vx;
    let nz = vz;
    const vMag = Math.sqrt(nx * nx + nz * nz);

    if (vMag >= 0.5) {
      nx = nx / vMag;
      nz = nz / vMag;
    } else {
      // Vehicle is stationary at start line: derive forward normal directly from vehicle Yaw
      // In Forza, Yaw=0 is +Z (North), Yaw=PI/2 is +X (East)
      nx = Math.sin(yaw);
      nz = Math.cos(yaw);
      if (nx === 0 && nz === 0) {
        nz = 1.0; // Default forward along +Z
      }
    }

    this.gate = {
      position: { x, y, z },
      normal: { x: nx, z: nz },
      widthMeters: width,
      createdAt: Date.now()
    };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('gp_custom_sf_gate', JSON.stringify(this.gate));
      }
    } catch {}

    // Reset current active lap to prepare for fresh crossing/launch from this gate
    this.currentLapIndex = 1;
    this.lapStartTime = 0;
    this.lapStartDistance = this.distanceTraveled;
    this.isLapDirty = false;
    this.dirtyReason = undefined;
    this.activeLapTrajectory = [];
    this.state = 'ARMED';
  }

  public getGate(): SpatialGate | null {
    return this.gate;
  }

  public getGateInfo(): {
    position: { x: number; y: number; z: number };
    normal: { x: number; z: number };
    headingDeg: number;
    widthMeters: number;
  } | null {
    if (!this.gate) return null;
    const heading = Math.round((((Math.atan2(this.gate.normal.x, this.gate.normal.z) * 180) / Math.PI + 360) % 360));
    return {
      position: this.gate.position,
      normal: this.gate.normal,
      headingDeg: heading,
      widthMeters: this.gate.widthMeters
    };
  }

  public clearGate() {
    this.gate = null;
    this.state = 'IDLE';
    this.currentLapIndex = 1;
    this.lapStartTime = 0;
    this.lapStartDistance = 0;
    this.isLapDirty = false;
    this.dirtyReason = undefined;
    this.activeLapTrajectory = [];
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('gp_custom_sf_gate');
      }
    } catch {}
  }

  public reset(keepGate = true) {
    if (!keepGate) {
      this.clearGate();
    }
    this.lastPos = null;
    this.lastTime = 0;
    this.lastTimestampMs = 0;
    this.state = this.gate ? 'ARMED' : 'IDLE';
    this.currentLapIndex = 1;
    this.lapStartTime = 0;
    this.lapStartDistance = 0;
    this.distanceTraveled = 0;
    this.lapTopSpeed = 0;
    this.isLapDirty = false;
    this.dirtyReason = undefined;
    this.activeLapTrajectory = [];
    this.completedLaps = [];
  }

  public processFrame(
    posX: number,
    posY: number,
    posZ: number,
    velX: number,
    _velY: number,
    velZ: number,
    speedMph: number,
    timestampSec: number,
    timestampMs = 0,
    gameCurrentLap = 0,
    gameLastLap = 0,
    gameLapNum = 0
  ): {
    liveLapTime: number;
    lapNumber: number;
    completedLap: LapRecord | null;
    state: MotionState;
    distanceToGate: number | null;
    isArmed: boolean;
    liveDeltaVsPb: number | null;
    isDirty: boolean;
  } {
    let completedLap: LapRecord | null = null;
    const currentSpeed = speedMph || 0;

    // 1. REWIND DETECTION (Timestamp or spatial reversal)
    if (
      (this.lastTimestampMs > 0 && timestampMs > 0 && timestampMs < this.lastTimestampMs - 250) ||
      (this.lastTime > 0 && timestampSec < this.lastTime - 0.5)
    ) {
      this.isLapDirty = true;
      this.dirtyReason = 'REWIND';
      this.state = 'REWOUND';
    }
    this.lastTimestampMs = timestampMs;

    // Track top speed on active lap
    if (currentSpeed > this.lapTopSpeed) {
      this.lapTopSpeed = currentSpeed;
    }

    // Distance integration
    if (this.lastTime > 0 && this.lastPos) {
      const dt = timestampSec - this.lastTime;
      if (dt > 0.001 && dt < 1.0 && currentSpeed > 0.5) {
        const dx = posX - this.lastPos.x;
        const dz = posZ - this.lastPos.z;
        const dMove = Math.sqrt(dx * dx + dz * dz);
        this.distanceTraveled += dMove;
      }
    }

    // Record trajectory point for live delta analysis (sample ~5Hz)
    const lapElapsed = this.lapStartTime > 0 ? timestampSec - this.lapStartTime : 0;
    const lapDist = Math.max(0, this.distanceTraveled - this.lapStartDistance);
    if (this.lapStartTime > 0 && lapDist > 0) {
      const lastPoint = this.activeLapTrajectory[this.activeLapTrajectory.length - 1];
      if (!lastPoint || lapDist - lastPoint.distanceMeters >= 10.0) {
        this.activeLapTrajectory.push({
          distanceMeters: lapDist,
          timeSec: lapElapsed,
          speedMph: currentSpeed
        });
      }
    }

    // 2. OFFICIAL GAME IN-CIRCUIT GATE SYNCHRONIZATION (When in-game telemetry is active)
    if (gameCurrentLap > 0 || gameLastLap > 0) {
      if (gameLastLap > 0 && gameLapNum > 1) {
        const targetLap = gameLapNum - 1;
        const alreadyLogged = this.completedLaps.some(l => l.lapNumber === targetLap && Math.abs(l.lapTime - gameLastLap) < 0.05);
        if (!alreadyLogged) {
          completedLap = {
            lapNumber: targetLap,
            lapTime: Number(gameLastLap.toFixed(3)),
            startTime: this.lapStartTime,
            endTime: timestampSec,
            startDistance: this.lapStartDistance,
            endDistance: this.distanceTraveled,
            topSpeedMph: Math.round(this.lapTopSpeed),
            valid: !this.isLapDirty,
            dirtyReason: this.dirtyReason,
            trajectory: [...this.activeLapTrajectory]
          };
          this.recordCompletedLap(completedLap);
          this.currentLapIndex = gameLapNum;
          this.lapStartTime = timestampSec;
          this.lapStartDistance = this.distanceTraveled;
          this.lapTopSpeed = currentSpeed;
          this.isLapDirty = false;
          this.dirtyReason = undefined;
          this.activeLapTrajectory = [];
          this.state = 'ARMED';
        }
      }

      this.lastPos = { x: posX, y: posY, z: posZ };
      this.lastTime = timestampSec;

      return {
        liveLapTime: gameCurrentLap,
        lapNumber: gameLapNum || this.currentLapIndex,
        completedLap,
        state: 'RUNNING',
        distanceToGate: null,
        isArmed: true,
        liveDeltaVsPb: this.calculateLiveDelta(lapDist, lapElapsed),
        isDirty: this.isLapDirty
      };
    }

    // 3. NO AUTO-GATE CREATION (Gate is strictly configured by the user via explicit Set S/F)
    const hasValid3D = (posX !== 0 || posZ !== 0) && !isNaN(posX) && !isNaN(posZ);
    if (!this.gate && (gameCurrentLap <= 0 && gameLastLap <= 0)) {
      this.state = 'IDLE';
      this.lastPos = { x: posX, y: posY, z: posZ };
      this.lastTime = timestampSec;

      return {
        liveLapTime: 0,
        lapNumber: 0,
        completedLap: null,
        state: 'IDLE',
        distanceToGate: null,
        isArmed: false,
        liveDeltaVsPb: null,
        isDirty: false
      };
    }

    // 4. SPATIAL HYPERPLANE CROSSING DETECTION
    let distanceToGate: number | null = null;
    if (this.gate && hasValid3D) {
      const dxToGate = posX - this.gate.position.x;
      const dzToGate = posZ - this.gate.position.z;
      distanceToGate = Math.sqrt(dxToGate * dxToGate + dzToGate * dzToGate);

      // Arm gate after vehicle leaves the starting zone
      if (this.state === 'RUNNING' || this.state === 'REWOUND') {
        if (lapElapsed >= this.minLapDurationSec && lapDist >= this.minLapDistanceMeters) {
          this.state = 'ARMED';
        }
      } else if (this.state === 'IDLE' && currentSpeed > 5) {
        this.state = 'ARMED';
      }

      // Check plane crossing if armed or starting first lap
      if ((this.state === 'ARMED' || this.lapStartTime === 0) && this.lastPos) {
        // Signed distance of previous and current position to gate plane: d = (P - P_gate) · n_gate
        const dPrev = (this.lastPos.x - this.gate.position.x) * this.gate.normal.x + (this.lastPos.z - this.gate.position.z) * this.gate.normal.z;
        const dCurr = (posX - this.gate.position.x) * this.gate.normal.x + (posZ - this.gate.position.z) * this.gate.normal.z;

        // Crossing condition: Transitioned across plane from negative to positive side
        const crossedPlane = (dPrev <= 0 && dCurr > 0) || (dPrev < 0 && dCurr >= 0);

        if (crossedPlane) {
          // Check lateral track boundary: project crossing point perpendicular to normal
          const tSub = Math.abs(dPrev) / (Math.abs(dPrev) + Math.abs(dCurr) || 1.0);
          const crossX = this.lastPos.x + tSub * (posX - this.lastPos.x);
          const crossZ = this.lastPos.z + tSub * (posZ - this.lastPos.z);

          // Lateral distance from gate center
          const latDist = Math.sqrt(Math.pow(crossX - this.gate.position.x, 2) + Math.pow(crossZ - this.gate.position.z, 2));

          // Forward velocity alignment
          const vMag = Math.sqrt(velX * velX + velZ * velZ) || 1.0;
          const forwardDot = (velX / vMag) * this.gate.normal.x + (velZ / vMag) * this.gate.normal.z;

          if (latDist <= this.gate.widthMeters && forwardDot > 0.40) {
            // Precise temporal interpolation
            const dt = timestampSec - this.lastTime;
            const exactCrossingTime = this.lastTime + tSub * dt;

            // If this is the initial crossing starting Lap 1:
            if (this.lapStartTime === 0) {
              this.lapStartTime = exactCrossingTime;
              this.lapStartDistance = this.distanceTraveled;
              this.currentLapIndex = 1;
              this.lapTopSpeed = currentSpeed;
              this.isLapDirty = false;
              this.dirtyReason = undefined;
              this.state = 'RUNNING';
            } else if (this.state === 'ARMED') {
              // Completed Lap!
              const lapTime = Number((exactCrossingTime - this.lapStartTime).toFixed(3));

              if (lapTime >= this.minLapDurationSec) {
                completedLap = {
                  lapNumber: this.currentLapIndex,
                  lapTime,
                  startTime: this.lapStartTime,
                  endTime: exactCrossingTime,
                  startDistance: this.lapStartDistance,
                  endDistance: this.distanceTraveled,
                  topSpeedMph: Math.round(this.lapTopSpeed),
                  valid: !this.isLapDirty,
                  dirtyReason: this.dirtyReason,
                  trajectory: [...this.activeLapTrajectory]
                };

                this.recordCompletedLap(completedLap);
                this.currentLapIndex++;
                this.lapStartTime = exactCrossingTime;
                this.lapStartDistance = this.distanceTraveled;
                this.lapTopSpeed = currentSpeed;
                this.isLapDirty = false;
                this.dirtyReason = undefined;
                this.activeLapTrajectory = [];
                this.state = 'RUNNING'; // Disarm until circuit minimum distance is driven
              }
            }
          }
        }
      }
    }

    this.lastPos = { x: posX, y: posY, z: posZ };
    this.lastTime = timestampSec;

    const liveLapTime = this.lapStartTime > 0 ? Math.max(0, timestampSec - this.lapStartTime) : 0;
    const liveDeltaVsPb = this.calculateLiveDelta(lapDist, liveLapTime);

    return {
      liveLapTime,
      lapNumber: this.currentLapIndex,
      completedLap,
      state: this.state,
      distanceToGate,
      isArmed: this.state === 'ARMED',
      liveDeltaVsPb,
      isDirty: this.isLapDirty
    };
  }

  private recordCompletedLap(lap: LapRecord) {
    this.completedLaps.push(lap);
    // Update best lap trajectory if valid and faster
    if (lap.valid && lap.trajectory && lap.trajectory.length > 5) {
      const bestValid = this.getBestLap();
      if (bestValid && bestValid.lapTime === lap.lapTime) {
        this.bestLapTrajectory = lap.trajectory;
      }
    }
  }

  private calculateLiveDelta(currentDist: number, currentTime: number): number | null {
    if (this.bestLapTrajectory.length < 5 || currentDist < 20 || currentTime < 1) {
      return null;
    }

    // Binary search / interpolation for PB time at currentDist
    const traj = this.bestLapTrajectory;
    if (currentDist > traj[traj.length - 1].distanceMeters) {
      return null;
    }

    let low = 0;
    let high = traj.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (traj[mid].distanceMeters < currentDist) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.min(traj.length - 1, Math.max(1, low));
    const p0 = traj[idx - 1];
    const p1 = traj[idx];

    const dSpan = p1.distanceMeters - p0.distanceMeters || 1.0;
    const frac = (currentDist - p0.distanceMeters) / dSpan;
    const pbTimeAtDist = p0.timeSec + frac * (p1.timeSec - p0.timeSec);

    const delta = currentTime - pbTimeAtDist;
    return Number(delta.toFixed(2));
  }

  public getCompletedLaps(): LapRecord[] {
    return this.completedLaps;
  }

  public getBestLap(): LapRecord | null {
    const valid = this.completedLaps.filter(l => l.valid);
    if (valid.length === 0) return null;
    return valid.reduce((best, cur) => cur.lapTime < best.lapTime ? cur : best, valid[0]);
  }
}

export const globalLapEngine = new LapInferenceEngine();
