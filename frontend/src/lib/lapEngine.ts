/**
 * GridPulse — Spatial Lap Inference & Vehicle-Motion State Engine
 * Engineered for sub-millisecond start/finish plane crossings,
 * vehicle-motion state machine, rewind detection, and sub-frame temporal interpolation.
 */

export interface SpatialGate {
  position: { x: number; y: number; z: number };
  normal: { x: number; z: number }; // Forward unit vector along track direction
  widthMeters: number; // Total gate width (crossing allowed within widthMeters / 2)
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
export type TimingMode = 'NONE' | 'NATIVE' | 'CUSTOM';

export function logLapEvent(event: string, details?: Record<string, any>) {
  if (typeof window !== 'undefined' && (window as any).__GP_DEBUG_LAP) {
    console.log(`[LapEngine:${event}]`, details || '');
  }
}

export function playGateChime(type: 'set' | 'lap' | 'armed') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'set' || type === 'armed') {
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
  private needsBaseline = true;

  private state: MotionState = 'IDLE';
  private timingMode: TimingMode = 'NONE';
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
  private minLapDistanceMeters = 200.0; // Minimum circuit distance to re-arm finish gate

  constructor() {
    this.loadSavedGate();
  }

  private loadSavedGate() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('gp_custom_sf_gate');
        if (saved) {
          this.gate = JSON.parse(saved);
          this.state = 'ARMED';
          this.timingMode = 'CUSTOM';
          this.needsBaseline = true;
          logLapEvent('LOADED_SAVED_GATE', { gate: this.gate });
        }
      }
    } catch {}
  }

  /**
   * 1. SET S/F GATE (or MOVE S/F HERE)
   * Creates or updates the custom spatial gate, persists to localStorage,
   * arms the gate, and resets active lap so crossing starts Lap 1.
   */
  public setCustomGate(x: number, y: number, z: number, vx = 0, vz = 0, yaw = 0, width = 30.0) {
    let nx = vx;
    let nz = vz;
    const vMag = Math.sqrt(nx * nx + nz * nz);

    if (vMag >= 0.5) {
      nx = nx / vMag;
      nz = nz / vMag;
    } else {
      // Stationary: derive forward normal from vehicle Yaw (Yaw 0 = +Z, Yaw PI/2 = +X)
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

    // Prepare fresh Time Attack baseline
    this.timingMode = 'CUSTOM';
    this.state = 'ARMED';
    this.currentLapIndex = 1;
    this.lapStartTime = 0;
    this.lapStartDistance = this.distanceTraveled;
    this.lapTopSpeed = 0;
    this.isLapDirty = false;
    this.dirtyReason = undefined;
    this.activeLapTrajectory = [];
    this.needsBaseline = true;

    logLapEvent('SET_GATE', { gate: this.gate, state: this.state });
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

  /**
   * 2. RESET LAP
   * KEEPS the S/F gate.
   * Clears active lap timing, trajectory, and dirty state.
   * Resets lap counter to 1, sets state to ARMED so the next crossing starts a fresh Lap 1.
   * Preserves completed laps and Personal Best.
   */
  public resetLap() {
    this.currentLapIndex = 1;
    this.lapStartTime = 0;
    this.lapStartDistance = this.distanceTraveled;
    this.lapTopSpeed = 0;
    this.isLapDirty = false;
    this.dirtyReason = undefined;
    this.activeLapTrajectory = [];
    this.state = this.gate ? 'ARMED' : 'IDLE';
    this.needsBaseline = true;

    logLapEvent('RESET_LAP', {
      hasGate: !!this.gate,
      state: this.state,
      lapNumber: this.currentLapIndex
    });
  }

  /**
   * 3. CLEAR S/F GATE
   * Removes custom gate, clears localStorage key, returns to IDLE mode.
   * Preserves completed laps and PB.
   */
  public clearGate() {
    this.gate = null;
    this.state = 'IDLE';
    this.timingMode = 'NONE';
    this.currentLapIndex = 1;
    this.lapStartTime = 0;
    this.lapStartDistance = 0;
    this.lapTopSpeed = 0;
    this.isLapDirty = false;
    this.dirtyReason = undefined;
    this.activeLapTrajectory = [];
    this.needsBaseline = true;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('gp_custom_sf_gate');
      }
    } catch {}

    logLapEvent('CLEAR_GATE', { state: this.state, timingMode: this.timingMode });
  }

  /**
   * Reset method maintaining keepGate parameter contract
   */
  public reset(keepGate = true) {
    if (!keepGate) {
      this.clearGate();
    } else {
      this.resetLap();
    }
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
    timingMode: TimingMode;
  } {
    let completedLap: LapRecord | null = null;
    const currentSpeed = speedMph || 0;

    // Determine Timing Mode: CUSTOM mode with spatial gate takes absolute precedence
    if (this.gate) {
      this.timingMode = 'CUSTOM';
    } else if (gameCurrentLap > 0 || (gameLastLap > 0 && gameLapNum > 0)) {
      this.timingMode = 'NATIVE';
    } else {
      this.timingMode = 'NONE';
    }

    // 1. REWIND DETECTION (Timestamp reversal or clock step back > 250ms)
    if (
      (this.lastTimestampMs > 0 && timestampMs > 0 && timestampMs < this.lastTimestampMs - 250) ||
      (this.lastTime > 0 && timestampSec < this.lastTime - 0.5)
    ) {
      this.isLapDirty = true;
      this.dirtyReason = 'REWIND';
      this.state = 'REWOUND';
      logLapEvent('REWIND', {
        timestampMs,
        lastTimestampMs: this.lastTimestampMs,
        timestampSec,
        lastTime: this.lastTime
      });
    }
    this.lastTimestampMs = timestampMs;

    // Track peak speed on active lap
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

    // Record trajectory points at ~5Hz for live delta comparison vs PB
    const lapElapsed = this.lapStartTime > 0 ? Math.max(0, timestampSec - this.lapStartTime) : 0;
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

    // =========================================================================
    // MODE A: NATIVE FH6 IN-GAME CIRCUIT TIMING
    // =========================================================================
    if (this.timingMode === 'NATIVE') {
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
          logLapEvent('LAP_COMPLETED', { mode: 'NATIVE', lap: completedLap });
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
        isDirty: this.isLapDirty,
        timingMode: 'NATIVE'
      };
    }

    // =========================================================================
    // MODE B: NONE / IDLE (No Custom Gate & No In-Game Race Active)
    // =========================================================================
    if (this.timingMode === 'NONE' || !this.gate) {
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
        isDirty: false,
        timingMode: 'NONE'
      };
    }

    // =========================================================================
    // MODE C: CUSTOM SPATIAL S/F TIME ATTACK (Takes Precedence)
    // =========================================================================
    const hasValid3D = (posX !== 0 || posZ !== 0) && !isNaN(posX) && !isNaN(posZ);
    let distanceToGate: number | null = null;

    if (hasValid3D) {
      const dxToGate = posX - this.gate.position.x;
      const dzToGate = posZ - this.gate.position.z;
      distanceToGate = Math.sqrt(dxToGate * dxToGate + dzToGate * dzToGate);

      // Handle Post-Reset Baseline Establishment:
      // First frame after Reset/Set Gate establishes the baseline without evaluating crossing
      if (this.needsBaseline || !this.lastPos || this.lastTime === 0) {
        this.lastPos = { x: posX, y: posY, z: posZ };
        this.lastTime = timestampSec;
        this.needsBaseline = false;

        return {
          liveLapTime: this.lapStartTime > 0 ? Math.max(0, timestampSec - this.lapStartTime) : 0,
          lapNumber: this.currentLapIndex,
          completedLap: null,
          state: this.state,
          distanceToGate,
          isArmed: this.state === 'ARMED',
          liveDeltaVsPb: null,
          isDirty: this.isLapDirty,
          timingMode: 'CUSTOM'
        };
      }

      // Circuit Re-Arming: after completing/starting a lap, disarm until circuit minimums are met
      if (this.state === 'RUNNING' || this.state === 'REWOUND') {
        if (lapElapsed >= this.minLapDurationSec && lapDist >= this.minLapDistanceMeters) {
          this.state = 'ARMED';
          logLapEvent('REARM', { lapElapsed, lapDist });
        }
      }

      // Check Plane Crossing when ARMED or awaiting initial start line crossing (lapStartTime === 0)
      if (this.state === 'ARMED' || this.lapStartTime === 0) {
        const nx = this.gate.normal.x;
        const nz = this.gate.normal.z;
        const tx = -nz;
        const tz = nx;
        const halfWidth = this.gate.widthMeters / 2.0;

        // Signed plane distance: d = (P - P_gate) · n_gate
        const dPrev = (this.lastPos.x - this.gate.position.x) * nx + (this.lastPos.z - this.gate.position.z) * nz;
        const dCurr = (posX - this.gate.position.x) * nx + (posZ - this.gate.position.z) * nz;

        // Plane Crossing Condition: Transitioned from negative to positive side
        const crossedPlane = (dPrev <= 0 && dCurr > 0) || (dPrev < 0 && dCurr >= 0);

        if (crossedPlane) {
          const denom = Math.abs(dPrev) + Math.abs(dCurr) || 1.0;
          const tSub = Math.min(1.0, Math.max(0.0, Math.abs(dPrev) / denom));
          const crossX = this.lastPos.x + tSub * (posX - this.lastPos.x);
          const crossZ = this.lastPos.z + tSub * (posZ - this.lastPos.z);

          // Correct Lateral Distance along gate tangent:
          const latDist = Math.abs((crossX - this.gate.position.x) * tx + (crossZ - this.gate.position.z) * tz);

          // Forward Velocity Alignment
          const vMag = Math.sqrt(velX * velX + velZ * velZ) || 1.0;
          const forwardDot = (velX / vMag) * nx + (velZ / vMag) * nz;

          const isWithinWidth = latDist <= halfWidth;
          const isForward = forwardDot > 0.35;
          const hasSpeed = currentSpeed >= 3.0;

          if (isWithinWidth && isForward && hasSpeed) {
            const dt = timestampSec - this.lastTime;
            const exactCrossingTime = this.lastTime + tSub * dt;

            // Scenario 1: Initial crossing starting Lap 1
            if (this.lapStartTime === 0) {
              this.lapStartTime = exactCrossingTime;
              this.lapStartDistance = this.distanceTraveled;
              this.currentLapIndex = 1;
              this.lapTopSpeed = currentSpeed;
              this.isLapDirty = false;
              this.dirtyReason = undefined;
              this.activeLapTrajectory = [];
              this.state = 'RUNNING';
              playGateChime('lap');

              logLapEvent('FIRST_SF_CROSSING', {
                exactCrossingTime,
                speed: currentSpeed,
                crossX,
                crossZ,
                latDist,
                forwardDot
              });
            } else if (this.state === 'ARMED') {
              // Scenario 2: Circuit lap completed
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
                this.state = 'RUNNING'; // Disarm until circuit minimums are met
                playGateChime('lap');

                logLapEvent('LAP_COMPLETED', {
                  lap: completedLap,
                  nextLap: this.currentLapIndex
                });
              }
            }
          } else {
            // Log exactly why candidate plane crossing was ignored
            logLapEvent('IGNORED_CROSSING', {
              dPrev,
              dCurr,
              tSub,
              crossX,
              crossZ,
              latDist,
              halfWidth,
              forwardDot,
              currentSpeed,
              state: this.state,
              lapStartTime: this.lapStartTime,
              lapDist,
              gateNormal: { nx, nz },
              reason: !isWithinWidth ? 'OUTSIDE_GATE_WIDTH' : (!isForward ? 'WRONG_DIRECTION' : 'TOO_SLOW')
            });
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
      isDirty: this.isLapDirty,
      timingMode: 'CUSTOM'
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

