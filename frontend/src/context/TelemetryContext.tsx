import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { WebRtcTelemetryClient, type WebRtcDiagnostics } from '../lib/webrtc';
import { getApiBaseUrl } from '../lib/api';

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
  slip_angle_fl: number;
  slip_angle_fr: number;
  slip_angle_rl: number;
  slip_angle_rr: number;
  slip_ratio_fl: number;
  slip_ratio_fr: number;
  slip_ratio_rl: number;
  slip_ratio_rr: number;
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
  car_class: number;
  car_class_name: string;
  car_performance_index: number;
  drivetrain_type: number;
  drivetrain_name: string;
  num_cylinders: number;
  best_lap: number;
  last_lap: number;
  current_lap: number;
  current_race_time: number;
  lap_number: number;
  race_position: number;
  is_race_on: number;
  timestamp_ms: number;
  distance_traveled: number;
}

export interface AnalyticsState {
  sprint_status?: string;
  sprint_times?: Record<string, any>;
  current_sprint?: {
    category: string;
    start_time: number;
    current_time: number;
    current_speed_mph: number;
    distance_feet: number;
  } | null;
  recent_records?: Array<{
    id?: number | string;
    category: string;
    time_seconds?: number;
    speed_mph?: number;
    distance_feet?: number;
    car_name?: string;
    car_class?: string;
    car_pi?: number;
    created_at?: string;
  }>;
  daily_awards?: Record<string, {
    award_type: string;
    title: string;
    icon: string;
    value: number;
    unit: string;
    gamertag: string;
    car_name: string;
  }>;
}

export type TransportType = 'webrtc_p2p' | 'websocket_local' | 'disconnected' | 'pairing_required';

export interface TelemetryContextType {
  telemetry: TelemetryData | null;
  analytics: AnalyticsState | null;
  connected: boolean;
  reconnecting: boolean;
  transport: TransportType;
  latencyMs: number;
  isDirectP2P: boolean;
  candidateType: string;
  transportLabel: string;
  packetRateHz: number;
  cloudTelemetryBytes: number;
  diagnostics?: WebRtcDiagnostics | null;
}

const TelemetryContext = createContext<TelemetryContextType | null>(null);

function getTelemetryWsUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const bridgeParam = urlParams.get('bridge');
      if (bridgeParam && bridgeParam.trim()) {
        const clean = bridgeParam.trim().replace(/\/$/, '');
        localStorage.setItem('gridpulse_telemetry_host', clean);
      }

      const saved = localStorage.getItem('gridpulse_telemetry_host');
      if (saved && saved.trim()) {
        let host = saved.trim();
        if (host.startsWith('ws://') || host.startsWith('wss://')) {
          return host.endsWith('/ws') ? host : `${host.replace(/\/$/, '')}/ws`;
        }
        if (host.startsWith('http://')) {
          return `ws://${host.slice(7).replace(/\/$/, '')}/ws`;
        }
        if (host.startsWith('https://')) {
          return `wss://${host.slice(8).replace(/\/$/, '')}/ws`;
        }
        return `ws://${host.replace(/\/$/, '')}/ws`;
      }

      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const port = window.location.port ? `:${window.location.port}` : (import.meta.env.DEV ? ':8000' : '');
        return `${protocol}//${host}${port}/ws`;
      }
    } catch {}
  }

  return 'ws://localhost:8000/ws';
}

function normalizeTelemetry(raw: Record<string, any>): TelemetryData {
  const speed = typeof raw.Speed === 'number' ? raw.Speed : (typeof raw.speed === 'number' ? raw.speed : 0);
  const powerW = typeof raw.Power === 'number' ? raw.Power : (typeof raw.power === 'number' ? raw.power : 0);
  const torqueNm = typeof raw.Torque === 'number' ? raw.Torque : (typeof raw.torque === 'number' ? raw.torque : 0);
  const boost = typeof raw.Boost === 'number' ? raw.Boost : (typeof raw.boost === 'number' ? raw.boost : 0);

  const speedMph = typeof raw.speed_mph === 'number' ? raw.speed_mph : speed * 2.23694;
  const speedKph = typeof raw.speed_kph === 'number' ? raw.speed_kph : speed * 3.6;

  const velX = typeof raw.VelocityX === 'number' ? raw.VelocityX : (typeof raw.velocity_x === 'number' ? raw.velocity_x : 0);
  const velZ = typeof raw.VelocityZ === 'number' ? raw.VelocityZ : (typeof raw.velocity_z === 'number' ? raw.velocity_z : 0);
  
  // Drift angle only has physical meaning when vehicle is moving
  const isMoving = speedMph >= 1.5;
  const driftRad = isMoving ? Math.atan2(velX, velZ) : 0;
  const driftDeg = isMoving ? driftRad * (180.0 / Math.PI) : 0;
  const angVelY = typeof raw.AngularVelocityY === 'number' ? raw.AngularVelocityY : (typeof raw.angular_velocity_y === 'number' ? raw.angular_velocity_y : 0);
  const yawRateDeg = isMoving && Math.abs(angVelY) > 0.001 ? angVelY * (180.0 / Math.PI) : 0;

  // Clean micro floating-point power & torque noise
  const calculatedHp = typeof raw.power_hp === 'number' ? raw.power_hp : powerW * 0.00134102;
  const calculatedTq = typeof raw.torque_ftlb === 'number' ? raw.torque_ftlb : torqueNm * 0.737562;
  const cleanHp = Math.abs(calculatedHp) < 0.2 ? 0 : calculatedHp;
  const cleanTq = Math.abs(calculatedTq) < 0.2 ? 0 : calculatedTq;

  return {
    speed_mph: speedMph,
    speed_kph: speedKph,
    current_engine_rpm: typeof raw.CurrentEngineRpm === 'number' ? raw.CurrentEngineRpm : (typeof raw.current_engine_rpm === 'number' ? raw.current_engine_rpm : 0),
    engine_max_rpm: typeof raw.EngineMaxRpm === 'number' ? raw.EngineMaxRpm : (typeof raw.engine_max_rpm === 'number' ? raw.engine_max_rpm : 8500),
    gear: typeof raw.Gear === 'number' ? raw.Gear : (typeof raw.gear === 'number' ? raw.gear : 0),
    accel: typeof raw.Accel === 'number' ? raw.Accel : (typeof raw.accel === 'number' ? raw.accel : 0),
    brake: typeof raw.Brake === 'number' ? raw.Brake : (typeof raw.brake === 'number' ? raw.brake : 0),
    clutch: typeof raw.Clutch === 'number' ? raw.Clutch : (typeof raw.clutch === 'number' ? raw.clutch : 0),
    handbrake: typeof raw.HandBrake === 'number' ? raw.HandBrake : (typeof raw.handbrake === 'number' ? raw.handbrake : 0),
    steer: typeof raw.Steer === 'number' ? raw.Steer : (typeof raw.steer === 'number' ? raw.steer : 0),
    tire_temp_fl: typeof raw.TireTempFrontLeft === 'number' ? raw.TireTempFrontLeft : (typeof raw.tire_temp_fl === 'number' ? raw.tire_temp_fl : 100),
    tire_temp_fr: typeof raw.TireTempFrontRight === 'number' ? raw.TireTempFrontRight : (typeof raw.tire_temp_fr === 'number' ? raw.tire_temp_fr : 100),
    tire_temp_rl: typeof raw.TireTempRearLeft === 'number' ? raw.TireTempRearLeft : (typeof raw.tire_temp_rl === 'number' ? raw.tire_temp_rl : 100),
    tire_temp_rr: typeof raw.TireTempRearRight === 'number' ? raw.TireTempRearRight : (typeof raw.tire_temp_rr === 'number' ? raw.tire_temp_rr : 100),
    tire_slip_fl: typeof raw.TireCombinedSlipFrontLeft === 'number' ? raw.TireCombinedSlipFrontLeft : (typeof raw.tire_slip_fl === 'number' ? raw.tire_slip_fl : 0),
    tire_slip_fr: typeof raw.TireCombinedSlipFrontRight === 'number' ? raw.TireCombinedSlipFrontRight : (typeof raw.tire_slip_fr === 'number' ? raw.tire_slip_fr : 0),
    tire_slip_rl: typeof raw.TireCombinedSlipRearLeft === 'number' ? raw.TireCombinedSlipRearLeft : (typeof raw.tire_slip_rl === 'number' ? raw.tire_slip_rl : 0),
    tire_slip_rr: typeof raw.TireCombinedSlipRearRight === 'number' ? raw.TireCombinedSlipRearRight : (typeof raw.tire_slip_rr === 'number' ? raw.tire_slip_rr : 0),
    slip_angle_fl: typeof raw.TireSlipAngleFrontLeft === 'number' ? raw.TireSlipAngleFrontLeft : (typeof raw.slip_angle_fl === 'number' ? raw.slip_angle_fl : 0),
    slip_angle_fr: typeof raw.TireSlipAngleFrontRight === 'number' ? raw.TireSlipAngleFrontRight : (typeof raw.slip_angle_fr === 'number' ? raw.slip_angle_fr : 0),
    slip_angle_rl: typeof raw.TireSlipAngleRearLeft === 'number' ? raw.TireSlipAngleRearLeft : (typeof raw.slip_angle_rl === 'number' ? raw.slip_angle_rl : 0),
    slip_angle_rr: typeof raw.TireSlipAngleRearRight === 'number' ? raw.TireSlipAngleRearRight : (typeof raw.slip_angle_rr === 'number' ? raw.slip_angle_rr : 0),
    slip_ratio_fl: typeof raw.TireSlipRatioFrontLeft === 'number' ? raw.TireSlipRatioFrontLeft : (typeof raw.slip_ratio_fl === 'number' ? raw.slip_ratio_fl : 0),
    slip_ratio_fr: typeof raw.TireSlipRatioFrontRight === 'number' ? raw.TireSlipRatioFrontRight : (typeof raw.slip_ratio_fr === 'number' ? raw.slip_ratio_fr : 0),
    slip_ratio_rl: typeof raw.TireSlipRatioRearLeft === 'number' ? raw.TireSlipRatioRearLeft : (typeof raw.slip_ratio_rl === 'number' ? raw.slip_ratio_rl : 0),
    slip_ratio_rr: typeof raw.TireSlipRatioRearRight === 'number' ? raw.TireSlipRatioRearRight : (typeof raw.slip_ratio_rr === 'number' ? raw.slip_ratio_rr : 0),
    susp_fl: typeof raw.NormalizedSuspensionTravelFrontLeft === 'number' ? raw.NormalizedSuspensionTravelFrontLeft : (typeof raw.susp_fl === 'number' ? raw.susp_fl : 0.5),
    susp_fr: typeof raw.NormalizedSuspensionTravelFrontRight === 'number' ? raw.NormalizedSuspensionTravelFrontRight : (typeof raw.susp_fr === 'number' ? raw.susp_fr : 0.5),
    susp_rl: typeof raw.NormalizedSuspensionTravelRearLeft === 'number' ? raw.NormalizedSuspensionTravelRearLeft : (typeof raw.susp_rl === 'number' ? raw.susp_rl : 0.5),
    susp_rr: typeof raw.NormalizedSuspensionTravelRearRight === 'number' ? raw.NormalizedSuspensionTravelRearRight : (typeof raw.susp_rr === 'number' ? raw.susp_rr : 0.5),
    power_hp: cleanHp,
    torque_ftlb: cleanTq,
    boost_psi: typeof raw.boost_psi === 'number' ? raw.boost_psi : boost * 0.145038,
    fuel_pct: typeof raw.Fuel === 'number' ? raw.Fuel * 100 : (typeof raw.fuel_pct === 'number' ? raw.fuel_pct : 100),
    acceleration_x: typeof raw.AccelerationX === 'number' ? raw.AccelerationX : (typeof raw.acceleration_x === 'number' ? raw.acceleration_x : 0),
    acceleration_y: typeof raw.AccelerationY === 'number' ? raw.AccelerationY : (typeof raw.acceleration_y === 'number' ? raw.acceleration_y : 0),
    acceleration_z: typeof raw.AccelerationZ === 'number' ? raw.AccelerationZ : (typeof raw.acceleration_z === 'number' ? raw.acceleration_z : 0),
    velocity_x: velX,
    velocity_y: typeof raw.VelocityY === 'number' ? raw.VelocityY : (typeof raw.velocity_y === 'number' ? raw.velocity_y : 0),
    velocity_z: velZ,
    yaw: typeof raw.Yaw === 'number' ? raw.Yaw : (typeof raw.yaw === 'number' ? raw.yaw : 0),
    pitch: typeof raw.Pitch === 'number' ? raw.Pitch : (typeof raw.pitch === 'number' ? raw.pitch : 0),
    roll: typeof raw.Roll === 'number' ? raw.Roll : (typeof raw.roll === 'number' ? raw.roll : 0),
    drift_angle: typeof raw.drift_angle === 'number' ? (isMoving ? raw.drift_angle : 0) : Math.round(driftDeg * 10) / 10,
    yaw_rate_degs: typeof raw.yaw_rate_degs === 'number' ? (isMoving ? raw.yaw_rate_degs : 0) : Math.round(yawRateDeg * 10) / 10,
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
    car_class: typeof raw.CarClass === 'number' ? raw.CarClass : (typeof raw.car_class === 'number' ? raw.car_class : 4),
    car_class_name: typeof raw.car_class_name === 'string' ? raw.car_class_name : 'S1',
    car_performance_index: typeof raw.CarPerformanceIndex === 'number' ? raw.CarPerformanceIndex : (typeof raw.car_performance_index === 'number' ? raw.car_performance_index : 895),
    drivetrain_type: typeof raw.DrivetrainType === 'number' ? raw.DrivetrainType : (typeof raw.drivetrain_type === 'number' ? raw.drivetrain_type : 1),
    drivetrain_name: typeof raw.drivetrain_name === 'string' ? raw.drivetrain_name : 'RWD',
    num_cylinders: typeof raw.NumCylinders === 'number' ? raw.NumCylinders : (typeof raw.num_cylinders === 'number' ? raw.num_cylinders : 10),
    best_lap: typeof raw.BestLap === 'number' ? raw.BestLap : (typeof raw.best_lap === 'number' ? raw.best_lap : 0),
    last_lap: typeof raw.LastLap === 'number' ? raw.LastLap : (typeof raw.last_lap === 'number' ? raw.last_lap : 0),
    current_lap: typeof raw.CurrentLap === 'number' ? raw.CurrentLap : (typeof raw.current_lap === 'number' ? raw.current_lap : 0),
    current_race_time: typeof raw.CurrentRaceTime === 'number' ? raw.CurrentRaceTime : (typeof raw.current_race_time === 'number' ? raw.current_race_time : 0),
    lap_number: typeof raw.LapNumber === 'number' ? raw.LapNumber : (typeof raw.lap_number === 'number' ? raw.lap_number : 0),
    race_position: typeof raw.RacePosition === 'number' ? raw.RacePosition : (typeof raw.race_position === 'number' ? raw.race_position : 1),
    is_race_on: typeof raw.IsRaceOn === 'number' ? raw.IsRaceOn : (typeof raw.is_race_on === 'number' ? raw.is_race_on : 1),
    timestamp_ms: typeof raw.TimestampMS === 'number' ? raw.TimestampMS : (typeof raw.timestamp_ms === 'number' ? raw.timestamp_ms : Date.now()),
    distance_traveled: typeof raw.DistanceTraveled === 'number' ? raw.DistanceTraveled : (typeof raw.distance_traveled === 'number' ? raw.distance_traveled : 0),
  };
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsState | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [transport, setTransport] = useState<TransportType>('disconnected');
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [isDirectP2P, setIsDirectP2P] = useState<boolean>(false);
  const [candidateType, setCandidateType] = useState<string>('host');
  const [packetRateHz, setPacketRateHz] = useState<number>(0);
  const [diagnostics, setDiagnostics] = useState<WebRtcDiagnostics | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const webrtcClientRef = useRef<WebRtcTelemetryClient | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const packetCountRef = useRef<number>(0);
  const lastRateCheckRef = useRef<number>(Date.now());

  const handleIncomingTelemetry = (data: any) => {
    packetCountRef.current += 1;
    const now = Date.now();
    const elapsed = (now - lastRateCheckRef.current) / 1000;
    if (elapsed >= 1.0) {
      setPacketRateHz(Math.round(packetCountRef.current / elapsed));
      packetCountRef.current = 0;
      lastRateCheckRef.current = now;
    }

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
  };

  useEffect(() => {
    const connect = () => {
      const apiBase = getApiBaseUrl();
      const wsUrl = getTelemetryWsUrl();

      // On Local HTTP LAN or Localhost -> Direct WebSocket connects in 1ms with ZERO renegotiation on tab switch!
      const isLocalLan = typeof window !== 'undefined' && (
        window.location.protocol === 'http:' || 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.hostname.startsWith('192.168.') || 
        window.location.hostname.startsWith('10.') || 
        window.location.hostname.startsWith('172.')
      );

      if (isLocalLan) {
        fallbackToWebSocket();
        return;
      }

      let pairingCode: string | undefined;
      try {
        const params = new URLSearchParams(window.location.search);
        const codeParam = params.get('code');
        if (codeParam && codeParam.trim()) {
          pairingCode = codeParam.trim().replace(/\s+/g, '');
          localStorage.setItem('gridpulse_pairing_code', pairingCode);
        } else {
          pairingCode = localStorage.getItem('gridpulse_pairing_code') || undefined;
        }
      } catch {}

      // 1. Attempt WebRTC DataChannel (For HTTPS Cloud Deployments)
      if (typeof RTCPeerConnection !== 'undefined') {
        try {
          if (webrtcClientRef.current) {
            webrtcClientRef.current.cleanup();
          }

          webrtcClientRef.current = new WebRtcTelemetryClient({
            bridgeUrl: apiBase,
            pairingCode: pairingCode,
            onTelemetry: (payload) => {
              setConnected(true);
              setReconnecting(false);
              setTransport('webrtc_p2p');
              handleIncomingTelemetry(payload);
            },
            onLatency: (rtt) => {
              setLatencyMs(Math.round(rtt * 10) / 10);
            },
            onTransportInfo: (info) => {
              setIsDirectP2P(info.isDirectP2P);
              setCandidateType(info.candidateType);
            },
            onDiagnostics: (diag) => {
              setDiagnostics(diag);
            },
            onStateChange: (state) => {
              if (state === 'channel_open' || state === 'connected') {
                setConnected(true);
                setReconnecting(false);
                setTransport('webrtc_p2p');
              } else if (state === 'pairing_required') {
                setConnected(false);
                setReconnecting(false);
                setTransport('pairing_required');
              } else if (state === 'failed' || state === 'error') {
                fallbackToWebSocket();
              } else if (state === 'disconnected') {
                setConnected(false);
                setReconnecting(true);
              }
            }
          });

          webrtcClientRef.current.connect().catch(() => {
            fallbackToWebSocket();
          });
        } catch {
          fallbackToWebSocket();
        }
      } else {
        fallbackToWebSocket();
      }

      function fallbackToWebSocket() {
        if (window.location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
          setConnected(false);
          setReconnecting(true);
          setTransport('disconnected');
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 6000);
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
          return;
        }

        try {
          if (wsRef.current) {
            wsRef.current.close();
          }

          wsRef.current = new WebSocket(wsUrl);

          wsRef.current.onopen = () => {
            setConnected(true);
            setReconnecting(false);
            setTransport('websocket_local');
            reconnectAttemptsRef.current = 0;
          };

          wsRef.current.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              handleIncomingTelemetry(data);
            } catch (e) {
              console.error('Error parsing telemetry data:', e);
            }
          };

          wsRef.current.onclose = () => {
            setConnected(false);
            setReconnecting(true);
            setTransport('disconnected');
            
            const baseDelay = 1000;
            const maxDelay = 8000;
            const attempts = reconnectAttemptsRef.current;
            const delay = Math.min(baseDelay * Math.pow(1.5, attempts), maxDelay);
            
            reconnectAttemptsRef.current += 1;
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          };

          wsRef.current.onerror = () => {
            wsRef.current?.close();
          };
        } catch {
          setConnected(false);
          setReconnecting(true);
          setTransport('disconnected');
        }
      }
    };

    connect();

    const handleHostChange = () => {
      if (webrtcClientRef.current) webrtcClientRef.current.cleanup();
      if (wsRef.current) wsRef.current.close();
      connect();
    };

    window.addEventListener('gridpulse_telemetry_host_changed', handleHostChange);

    return () => {
      window.removeEventListener('gridpulse_telemetry_host_changed', handleHostChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (webrtcClientRef.current) {
        webrtcClientRef.current.cleanup();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  let transportLabel = 'OFFLINE';
  if (connected) {
    if (transport === 'websocket_local') {
      transportLabel = `DIRECT LAN (WebSocket) • ${latencyMs || '<2'}ms`;
    } else if (transport === 'webrtc_p2p') {
      if (candidateType === 'host') {
        transportLabel = `DIRECT P2P (Host ➔ Host) • ${latencyMs}ms`;
      } else if (candidateType === 'srflx' || candidateType === 'prflx') {
        transportLabel = `DIRECT P2P (STUN WAN) • ${latencyMs}ms`;
      } else if (candidateType === 'relay') {
        transportLabel = `RELAY (TURN / UDP) • ${latencyMs}ms`;
      } else {
        transportLabel = `P2P (${candidateType}) • ${latencyMs}ms`;
      }
    }
  }

  return (
    <TelemetryContext.Provider value={{
      telemetry,
      analytics,
      connected,
      reconnecting,
      transport,
      latencyMs,
      isDirectP2P,
      candidateType,
      transportLabel,
      packetRateHz,
      cloudTelemetryBytes: 0,
      diagnostics
    }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry(): TelemetryContextType {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}
