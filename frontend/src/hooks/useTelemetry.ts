import { useState, useEffect, useRef } from 'react';

export interface TelemetryData {
  speed_mph: number;
  speed_kph: number;
  current_engine_rpm: number;
  engine_max_rpm: number;
  gear: number;
  accel: number;
  brake: number;
  clutch: number;
  handbrake: number;
  steer: number;
  tire_temp_fl: number;
  tire_temp_fr: number;
  tire_temp_rl: number;
  tire_temp_rr: number;
  tire_slip_fl: number;
  tire_slip_fr: number;
  tire_slip_rl: number;
  tire_slip_rr: number;
  susp_fl: number;
  susp_fr: number;
  susp_rl: number;
  susp_rr: number;
  power_hp: number;
  torque_ftlb: number;
  boost_psi: number;
  fuel_pct: number;
  acceleration_x: number;
  acceleration_y: number;
  acceleration_z: number;
  velocity_x: number;
  velocity_y: number;
  velocity_z: number;
  yaw: number;
  pitch: number;
  roll: number;
  drift_angle: number;
  yaw_rate_degs: number;
  surface_rumble_fl: number;
  surface_rumble_fr: number;
  surface_rumble_rl: number;
  surface_rumble_rr: number;
  puddle_depth_fl: number;
  puddle_depth_fr: number;
  puddle_depth_rl: number;
  puddle_depth_rr: number;
  rumble_strip_fl: number;
  rumble_strip_fr: number;
  rumble_strip_rl: number;
  rumble_strip_rr: number;
  car_ordinal: number;
  car_class_name: string;
  car_performance_index: number;
  best_lap: number;
  current_lap: number;
  last_lap: number;
  race_position: number;
  drivetrain_type: number;
  drivetrain_name: string;
}

export interface AnalyticsData {
  sprint_active?: boolean;
  braking_active?: boolean;
  is_rewinding?: boolean;
  peak_tire_temp?: number;
  peak_lat_g?: number;
  peak_dec_g?: number;
  top_speed?: number;
  sprint_times?: Record<string, number>;
  sprint_status?: string;
}

function normalizeTelemetry(raw: Record<string, unknown>): TelemetryData {
  const speed = typeof raw.Speed === 'number' ? raw.Speed : 0;
  const powerW = typeof raw.Power === 'number' ? raw.Power : 0;
  const torqueNm = typeof raw.Torque === 'number' ? raw.Torque : 0;
  const boost = typeof raw.Boost === 'number' ? raw.Boost : 0;
  const fuel = typeof raw.Fuel === 'number' ? raw.Fuel : 1.0;
  const steerRaw = typeof raw.Steer === 'number' ? raw.Steer : (typeof raw.steer === 'number' ? raw.steer : 0);

  const velX = typeof raw.VelocityX === 'number' ? raw.VelocityX : 0;
  const velY = typeof raw.VelocityY === 'number' ? raw.VelocityY : 0;
  const velZ = typeof raw.VelocityZ === 'number' ? raw.VelocityZ : 0;
  const angVelY = typeof raw.AngularVelocityY === 'number' ? raw.AngularVelocityY : 0;

  // True vehicle body slip angle (drift angle) in degrees
  let driftAngle = 0;
  if (speed > 4.0) {
    // In vehicle coordinate frame: velX = lateral, velZ = forward
    const rawSlip = Math.atan2(Math.abs(velX), Math.abs(velZ)) * (180 / Math.PI);
    driftAngle = Math.min(90, Math.round(rawSlip));
  }

  return {
    speed_mph: typeof raw.speed_mph === 'number' ? raw.speed_mph : speed * 2.23694,
    speed_kph: typeof raw.speed_kph === 'number' ? raw.speed_kph : speed * 3.6,
    current_engine_rpm: typeof raw.CurrentEngineRpm === 'number' ? raw.CurrentEngineRpm : (typeof raw.current_engine_rpm === 'number' ? raw.current_engine_rpm : 0),
    engine_max_rpm: typeof raw.EngineMaxRpm === 'number' ? raw.EngineMaxRpm : (typeof raw.engine_max_rpm === 'number' ? raw.engine_max_rpm : 8000),
    gear: typeof raw.Gear === 'number' ? raw.Gear : (typeof raw.gear === 'number' ? raw.gear : 0),
    accel: typeof raw.Accel === 'number' ? raw.Accel : (typeof raw.accel === 'number' ? raw.accel : 0),
    brake: typeof raw.Brake === 'number' ? raw.Brake : (typeof raw.brake === 'number' ? raw.brake : 0),
    clutch: typeof raw.Clutch === 'number' ? raw.Clutch : (typeof raw.clutch === 'number' ? raw.clutch : 0),
    handbrake: typeof raw.HandBrake === 'number' ? raw.HandBrake : 0,
    steer: steerRaw / 127.0,
    tire_temp_fl: typeof raw.TireTempFrontLeft === 'number' ? raw.TireTempFrontLeft : (typeof raw.tire_temp_fl === 'number' ? raw.tire_temp_fl : 100),
    tire_temp_fr: typeof raw.TireTempFrontRight === 'number' ? raw.TireTempFrontRight : (typeof raw.tire_temp_fr === 'number' ? raw.tire_temp_fr : 100),
    tire_temp_rl: typeof raw.TireTempRearLeft === 'number' ? raw.TireTempRearLeft : (typeof raw.tire_temp_rl === 'number' ? raw.tire_temp_rl : 100),
    tire_temp_rr: typeof raw.TireTempRearRight === 'number' ? raw.TireTempRearRight : (typeof raw.tire_temp_rr === 'number' ? raw.tire_temp_rr : 100),
    tire_slip_fl: typeof raw.TireCombinedSlipFrontLeft === 'number' ? raw.TireCombinedSlipFrontLeft : (typeof raw.TireSlipRatioFrontLeft === 'number' ? Math.abs(raw.TireSlipRatioFrontLeft) : 0),
    tire_slip_fr: typeof raw.TireCombinedSlipFrontRight === 'number' ? raw.TireCombinedSlipFrontRight : (typeof raw.TireSlipRatioFrontRight === 'number' ? Math.abs(raw.TireSlipRatioFrontRight) : 0),
    tire_slip_rl: typeof raw.TireCombinedSlipRearLeft === 'number' ? raw.TireCombinedSlipRearLeft : (typeof raw.TireSlipRatioRearLeft === 'number' ? Math.abs(raw.TireSlipRatioRearLeft) : 0),
    tire_slip_rr: typeof raw.TireCombinedSlipRearRight === 'number' ? raw.TireCombinedSlipRearRight : (typeof raw.TireSlipRatioRearRight === 'number' ? Math.abs(raw.TireSlipRatioRearRight) : 0),
    susp_fl: typeof raw.NormalizedSuspensionTravelFrontLeft === 'number' ? raw.NormalizedSuspensionTravelFrontLeft : 0.5,
    susp_fr: typeof raw.NormalizedSuspensionTravelFrontRight === 'number' ? raw.NormalizedSuspensionTravelFrontRight : 0.5,
    susp_rl: typeof raw.NormalizedSuspensionTravelRearLeft === 'number' ? raw.NormalizedSuspensionTravelRearLeft : 0.5,
    susp_rr: typeof raw.NormalizedSuspensionTravelRearRight === 'number' ? raw.NormalizedSuspensionTravelRearRight : 0.5,
    power_hp: Math.max(0, Math.round(powerW * 0.00134102)),
    torque_ftlb: Math.max(0, Math.round(torqueNm * 0.737562)),
    boost_psi: Math.max(0, Number((boost * 14.5038).toFixed(1))),
    fuel_pct: Math.round(fuel * 100),
    acceleration_x: typeof raw.AccelerationX === 'number' ? raw.AccelerationX : (typeof raw.acceleration_x === 'number' ? raw.acceleration_x : 0),
    acceleration_y: typeof raw.AccelerationY === 'number' ? raw.AccelerationY : 0,
    acceleration_z: typeof raw.AccelerationZ === 'number' ? raw.AccelerationZ : (typeof raw.acceleration_z === 'number' ? raw.acceleration_z : 0),
    velocity_x: velX,
    velocity_y: velY,
    velocity_z: velZ,
    yaw: typeof raw.Yaw === 'number' ? raw.Yaw : 0,
    pitch: typeof raw.Pitch === 'number' ? raw.Pitch : 0,
    roll: typeof raw.Roll === 'number' ? raw.Roll : 0,
    drift_angle: driftAngle,
    yaw_rate_degs: Math.round(angVelY * (180 / Math.PI)),
    surface_rumble_fl: typeof raw.SurfaceRumbleFrontLeft === 'number' ? raw.SurfaceRumbleFrontLeft : 0,
    surface_rumble_fr: typeof raw.SurfaceRumbleFrontRight === 'number' ? raw.SurfaceRumbleFrontRight : 0,
    surface_rumble_rl: typeof raw.SurfaceRumbleRearLeft === 'number' ? raw.SurfaceRumbleRearLeft : 0,
    surface_rumble_rr: typeof raw.SurfaceRumbleRearRight === 'number' ? raw.SurfaceRumbleRearRight : 0,
    puddle_depth_fl: typeof raw.WheelInPuddleDepthFrontLeft === 'number' ? raw.WheelInPuddleDepthFrontLeft : 0,
    puddle_depth_fr: typeof raw.WheelInPuddleDepthFrontRight === 'number' ? raw.WheelInPuddleDepthFrontRight : 0,
    puddle_depth_rl: typeof raw.WheelInPuddleDepthRearLeft === 'number' ? raw.WheelInPuddleDepthRearLeft : 0,
    puddle_depth_rr: typeof raw.WheelInPuddleDepthRearRight === 'number' ? raw.WheelInPuddleDepthRearRight : 0,
    rumble_strip_fl: typeof raw.WheelOnRumbleStripFrontLeft === 'number' ? raw.WheelOnRumbleStripFrontLeft : 0,
    rumble_strip_fr: typeof raw.WheelOnRumbleStripFrontRight === 'number' ? raw.WheelOnRumbleStripFrontRight : 0,
    rumble_strip_rl: typeof raw.WheelOnRumbleStripRearLeft === 'number' ? raw.WheelOnRumbleStripRearLeft : 0,
    rumble_strip_rr: typeof raw.WheelOnRumbleStripRearRight === 'number' ? raw.WheelOnRumbleStripRearRight : 0,
    car_ordinal: typeof raw.CarOrdinal === 'number' ? raw.CarOrdinal : (typeof raw.car_ordinal === 'number' ? raw.car_ordinal : 2544),
    car_class_name: typeof raw.car_class_name === 'string' ? raw.car_class_name : 'S1',
    car_performance_index: typeof raw.CarPerformanceIndex === 'number' ? raw.CarPerformanceIndex : (typeof raw.car_performance_index === 'number' ? raw.car_performance_index : 895),
    best_lap: typeof raw.BestLap === 'number' ? raw.BestLap : (typeof raw.best_lap === 'number' ? raw.best_lap : 0),
    current_lap: typeof raw.CurrentLap === 'number' ? raw.CurrentLap : (typeof raw.current_lap === 'number' ? raw.current_lap : 0),
    last_lap: typeof raw.LastLap === 'number' ? raw.LastLap : (typeof raw.last_lap === 'number' ? raw.last_lap : 0),
    race_position: typeof raw.RacePosition === 'number' ? raw.RacePosition : (typeof raw.race_position === 'number' ? raw.race_position : 1),
    drivetrain_type: typeof raw.DrivetrainType === 'number' ? raw.DrivetrainType : (typeof raw.drivetrain_type === 'number' ? raw.drivetrain_type : 1),
    drivetrain_name: typeof raw.drivetrain_name === 'string' ? raw.drivetrain_name : 'RWD',
  };
}

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = import.meta.env.DEV
        ? 'ws://localhost:8000/ws'
        : `${protocol}//${window.location.host}/ws`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setConnected(true);
        setReconnecting(false);
        reconnectAttemptsRef.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.telemetry) {
            setTelemetry(normalizeTelemetry(data.telemetry));
          } else if (data.type === 'telemetry' && data.payload) {
            setTelemetry(normalizeTelemetry(data.payload));
          }

          if (data.analytics_state) {
            setAnalytics(data.analytics_state);
          } else if (data.type === 'analytics' && data.payload) {
            setAnalytics(data.payload);
          }
        } catch (e) {
          console.error('Error parsing telemetry data:', e);
        }
      };

      wsRef.current.onclose = () => {
        setConnected(false);
        setReconnecting(true);
        
        const baseDelay = 1000;
        const maxDelay = 10000;
        const attempts = reconnectAttemptsRef.current;
        const delay = Math.min(baseDelay * Math.pow(1.5, attempts), maxDelay);
        
        reconnectAttemptsRef.current += 1;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        wsRef.current?.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { telemetry, analytics, connected, reconnecting };
}
