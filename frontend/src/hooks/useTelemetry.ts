import { useState, useEffect, useRef } from 'react';
import { WebRtcTelemetryClient } from '../lib/webrtc';
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
  sprint_status: string;
  sprint_times: Record<string, number | null>;
  sprint_active: boolean;
  braking_active: boolean;
  peak_tire_temp: number;
  peak_lat_g: number;
  peak_dec_g: number;
  top_speed: number;
}

export function getTelemetryWsUrl(): string {
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
  const powerW = typeof raw.Power === 'number' ? raw.Power : 0;
  const torqueNm = typeof raw.Torque === 'number' ? raw.Torque : 0;
  const boost = typeof raw.Boost === 'number' ? raw.Boost : 0;

  const speedMph = typeof raw.speed_mph === 'number' ? raw.speed_mph : speed * 2.23694;
  const speedKph = typeof raw.speed_kph === 'number' ? raw.speed_kph : speed * 3.6;

  const velX = typeof raw.VelocityX === 'number' ? raw.VelocityX : (typeof raw.velocity_x === 'number' ? raw.velocity_x : 0);
  const velZ = typeof raw.VelocityZ === 'number' ? raw.VelocityZ : (typeof raw.velocity_z === 'number' ? raw.velocity_z : 0);
  const driftRad = Math.atan2(velX, velZ);
  const driftDeg = driftRad * (180.0 / Math.PI);
  const angVelY = typeof raw.AngularVelocityY === 'number' ? raw.AngularVelocityY : (typeof raw.angular_velocity_y === 'number' ? raw.angular_velocity_y : 0);
  const yawRateDeg = angVelY * (180.0 / Math.PI);

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
    susp_fl: typeof raw.NormalizedSuspensionTravelFrontLeft === 'number' ? raw.NormalizedSuspensionTravelFrontLeft : (typeof raw.susp_fl === 'number' ? raw.susp_fl : 0.5),
    susp_fr: typeof raw.NormalizedSuspensionTravelFrontRight === 'number' ? raw.NormalizedSuspensionTravelFrontRight : (typeof raw.susp_fr === 'number' ? raw.susp_fr : 0.5),
    susp_rl: typeof raw.NormalizedSuspensionTravelRearLeft === 'number' ? raw.NormalizedSuspensionTravelRearLeft : (typeof raw.susp_rl === 'number' ? raw.susp_rl : 0.5),
    susp_rr: typeof raw.NormalizedSuspensionTravelRearRight === 'number' ? raw.NormalizedSuspensionTravelRearRight : (typeof raw.susp_rr === 'number' ? raw.susp_rr : 0.5),
    power_hp: typeof raw.power_hp === 'number' ? raw.power_hp : powerW * 0.00134102,
    torque_ftlb: typeof raw.torque_ftlb === 'number' ? raw.torque_ftlb : torqueNm * 0.737562,
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
    drift_angle: typeof raw.drift_angle === 'number' ? raw.drift_angle : Math.round(driftDeg * 10) / 10,
    yaw_rate_degs: typeof raw.yaw_rate_degs === 'number' ? raw.yaw_rate_degs : Math.round(yawRateDeg * 10) / 10,
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
  const [transport, setTransport] = useState<'webrtc_p2p' | 'websocket_local' | 'disconnected'>('disconnected');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isDirectP2P, setIsDirectP2P] = useState(true);
  const [packetRateHz, setPacketRateHz] = useState<number>(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const webrtcClientRef = useRef<WebRtcTelemetryClient | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const packetCountRef = useRef(0);
  const lastPacketTimeRef = useRef(Date.now());

  const handleIncomingTelemetry = (data: any) => {
    packetCountRef.current += 1;
    const now = Date.now();
    if (now - lastPacketTimeRef.current >= 1000) {
      setPacketRateHz(packetCountRef.current);
      packetCountRef.current = 0;
      lastPacketTimeRef.current = now;
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

      // 1. Attempt WebRTC DataChannel First (P2P zero-cloud path)
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
            },
            onStateChange: (state) => {
              if (state === 'channel_open' || state === 'connected') {
                setConnected(true);
                setReconnecting(false);
                setTransport('webrtc_p2p');
              } else if (state === 'failed' || state === 'error') {
                // Fallback to local WebSocket if on local origin
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
        } catch (err) {
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

  return {
    telemetry,
    analytics,
    connected,
    reconnecting,
    transport,
    latencyMs,
    isDirectP2P,
    packetRateHz,
    cloudTelemetryBytes: 0
  };
}
