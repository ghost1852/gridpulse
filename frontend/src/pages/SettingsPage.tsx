import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { useUnits } from '../context/UnitContext';
import { useTelemetry } from '../hooks/useTelemetry';
import { 
  Gamepad2, 
  Cpu, 
  CheckCircle2, 
  Copy, 
  Check, 
  Radio, 
  Wifi, 
  Gauge, 
  Thermometer, 
  Zap, 
  Flame, 
  Sliders,
  Ruler,
  Scale,
  Server,
  RefreshCw
} from 'lucide-react';

export function SettingsPage() {
  const [simulate, setSimulate] = useState(false);
  const [udpPort, setUdpPort] = useState('20066');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [serverStatus, setServerStatus] = useState<any>(null);

  const [telemetryHost, setTelemetryHost] = useState<string>(() => {
    try {
      return localStorage.getItem('gridpulse_telemetry_host') || (
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8000' 
          : 'http://localhost:8000'
      );
    } catch {
      return 'http://localhost:8000';
    }
  });
  const [hostSaved, setHostSaved] = useState(false);

  const { units, setUnit } = useUnits();
  const { connected } = useTelemetry();

  const getApiBase = () => {
    try {
      const saved = localStorage.getItem('gridpulse_telemetry_host');
      if (saved && saved.trim()) {
        let host = saved.trim().replace(/\/$/, '');
        if (host.startsWith('ws://')) host = `http://${host.slice(5)}`;
        else if (host.startsWith('wss://')) host = `https://${host.slice(6)}`;
        else if (!host.startsWith('http')) host = `http://${host}`;
        return host;
      }
    } catch {}
    return '';
  };

  const fetchConfig = async () => {
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setSimulate(data.simulate);
        setUdpPort(String(data.udp_port));
        setServerStatus(data);
      }
    } catch {
      // Backend may be offline or initializing
    }
  };

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(fetchConfig, 2500);
    return () => clearInterval(interval);
  }, [telemetryHost]);

  const handleSaveHost = () => {
    try {
      const cleanHost = telemetryHost.trim().replace(/\/$/, '');
      localStorage.setItem('gridpulse_telemetry_host', cleanHost);
      window.dispatchEvent(new Event('gridpulse_telemetry_host_changed'));
      setHostSaved(true);
      fetchConfig();
      setTimeout(() => setHostSaved(false), 2000);
    } catch {}
  };

  const handleSaveMode = async (simMode: boolean) => {
    setSaving(true);
    try {
      const apiBase = getApiBase();
      await fetch(`${apiBase}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulate: simMode, udp_port: parseInt(udpPort, 10) })
      });
      setSimulate(simMode);
      await fetchConfig();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePort = async () => {
    setSaving(true);
    try {
      const apiBase = getApiBase();
      await fetch(`${apiBase}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulate, udp_port: parseInt(udpPort, 10) })
      });
      await fetchConfig();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Derive suggested in-game IP
  const getSuggestedForzaIp = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '127.0.0.1';
    }
    // If telemetryHost is configured with an IP, extract it
    const match = telemetryHost.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (match) {
      return match[1];
    }
    return '127.0.0.1';
  };

  const copyForzaSettings = () => {
    const text = `Data Out: ON\nData Out IP Address: ${getSuggestedForzaIp()}\nData Out IP Port: ${udpPort}\nData Out Packet Format: Car Dash`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCloudHost = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1' && 
    !window.location.hostname.startsWith('192.168.');

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto pb-24 overflow-y-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-white uppercase flex items-center gap-2">
          <Sliders className="text-emerald-400" />
          <span>SETTINGS &amp; PREFERENCES</span>
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 font-mono">
          Granular unit configuration, local backend telemetry gateway, and Forza Horizon connection
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 1. TELEMETRY BACKEND GATEWAY (Crucial for Web PWA)                         */}
      {/* ========================================================================= */}
      <Card className="p-5 space-y-4 bg-[#0e0e16] border-emerald-500/40 shadow-[0_0_25px_rgba(0,255,136,0.08)]">
        <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-emerald-400" />
            <h2 className="text-sm sm:text-base font-bold font-mono text-white">
              LOCAL TELEMETRY GATEWAY (PYTHON BACKEND)
            </h2>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-mono">
            <Radio size={11} className={connected ? "text-emerald-400 animate-pulse" : "text-amber-400"} />
            <span className={connected ? "text-emerald-400 font-bold" : "text-amber-400"}>
              {connected ? "60Hz LIVE STREAM" : "OFFLINE / DISCONNECTED"}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-300 font-mono leading-relaxed">
          {isCloudHost 
            ? "When running GridPulse from the cloud web host, connect to your PC's Python backend listener (where Forza transmits 60Hz UDP packets)."
            : "GridPulse communicates directly with your local Python FastAPI telemetry server via WebSocket & REST."}
        </p>

        <div className="space-y-3 font-mono text-xs">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-gray-400">
              Backend Server URL (Host &amp; Port)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={telemetryHost}
                onChange={(e) => setTelemetryHost(e.target.value)}
                placeholder="http://localhost:8000 or http://192.168.88.4:8000"
                className="flex-1 bg-black border border-white/20 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-emerald-400 transition-colors"
              />
              <button
                type="button"
                onClick={handleSaveHost}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black font-bold uppercase text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-[0_0_15px_rgba(0,255,136,0.3)]"
              >
                {hostSaved ? <Check size={14} /> : <RefreshCw size={14} />}
                <span>{hostSaved ? "Connected & Saved" : "Connect Gateway"}</span>
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            <span className="text-gray-500">Quick Presets:</span>
            <button
              type="button"
              onClick={() => { setTelemetryHost('http://localhost:8000'); }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 cursor-pointer"
            >
              Localhost (http://localhost:8000)
            </button>
            <button
              type="button"
              onClick={() => { setTelemetryHost('http://192.168.88.4:8000'); }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 cursor-pointer"
            >
              LAN PC (http://192.168.88.4:8000)
            </button>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* 2. UNITS OF MEASUREMENT CUSTOMIZER                                         */}
      {/* ========================================================================= */}
      <Card className="p-5 space-y-4 bg-[#0e0e16] border-white/10">
        <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Gauge size={18} className="text-emerald-400" />
            <h2 className="text-sm sm:text-base font-bold font-mono">
              INDIVIDUAL METRIC &amp; IMPERIAL UNIT CHOICES
            </h2>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Auto-Saved
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 font-mono text-xs">
          {/* Speed Unit */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-cyan-400" />
              <div>
                <span className="font-bold text-white block">Speed</span>
                <span className="text-[10px] text-gray-500">Speedometer &amp; Laps</span>
              </div>
            </div>
            <div className="flex rounded-lg bg-black/60 p-0.5 border border-white/10">
              <button
                onClick={() => setUnit('speed', 'mph')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.speed === 'mph' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                MPH
              </button>
              <button
                onClick={() => setUnit('speed', 'kph')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.speed === 'kph' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                KM/H
              </button>
            </div>
          </div>

          {/* Temperature Unit */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Thermometer size={16} className="text-rose-400" />
              <div>
                <span className="font-bold text-white block">Tire Thermals</span>
                <span className="text-[10px] text-gray-500">4-Corner Tire Temps</span>
              </div>
            </div>
            <div className="flex rounded-lg bg-black/60 p-0.5 border border-white/10">
              <button
                onClick={() => setUnit('temperature', 'f')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.temperature === 'f' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                °F (Fahrenheit)
              </button>
              <button
                onClick={() => setUnit('temperature', 'c')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.temperature === 'c' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                °C (Celsius)
              </button>
            </div>
          </div>

          {/* Tire Pressure Unit */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-amber-400" />
              <div>
                <span className="font-bold text-white block">Tire &amp; Turbo Pressure</span>
                <span className="text-[10px] text-gray-500">PSI / BAR / KPA</span>
              </div>
            </div>
            <div className="flex rounded-lg bg-black/60 p-0.5 border border-white/10">
              <button
                onClick={() => setUnit('pressure', 'psi')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.pressure === 'psi' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                PSI
              </button>
              <button
                onClick={() => setUnit('pressure', 'bar')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.pressure === 'bar' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                BAR
              </button>
              <button
                onClick={() => setUnit('pressure', 'kpa')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.pressure === 'kpa' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                KPA
              </button>
            </div>
          </div>

          {/* Engine Power Unit */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-yellow-400" />
              <div>
                <span className="font-bold text-white block">Engine Power</span>
                <span className="text-[10px] text-gray-500">HP / Kilowatts / BHP</span>
              </div>
            </div>
            <div className="flex rounded-lg bg-black/60 p-0.5 border border-white/10">
              <button
                onClick={() => setUnit('power', 'hp')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.power === 'hp' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                HP
              </button>
              <button
                onClick={() => setUnit('power', 'kw')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.power === 'kw' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                KW
              </button>
              <button
                onClick={() => setUnit('power', 'bhp')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.power === 'bhp' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                BHP
              </button>
            </div>
          </div>

          {/* Torque Unit */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame size={16} className="text-orange-400" />
              <div>
                <span className="font-bold text-white block">Engine Torque</span>
                <span className="text-[10px] text-gray-500">LB·FT or NM</span>
              </div>
            </div>
            <div className="flex rounded-lg bg-black/60 p-0.5 border border-white/10">
              <button
                onClick={() => setUnit('torque', 'lbft')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.torque === 'lbft' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                LB·FT
              </button>
              <button
                onClick={() => setUnit('torque', 'nm')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.torque === 'nm' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                NM
              </button>
            </div>
          </div>

          {/* Suspension & Ride Height Length */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ruler size={16} className="text-emerald-400" />
              <div>
                <span className="font-bold text-white block">Ride Height &amp; Travel</span>
                <span className="text-[10px] text-gray-500">Inches / CM / MM</span>
              </div>
            </div>
            <div className="flex rounded-lg bg-black/60 p-0.5 border border-white/10">
              <button
                onClick={() => setUnit('length', 'in')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.length === 'in' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                IN
              </button>
              <button
                onClick={() => setUnit('length', 'cm')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.length === 'cm' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                CM
              </button>
              <button
                onClick={() => setUnit('length', 'mm')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.length === 'mm' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                MM
              </button>
            </div>
          </div>

          {/* Spring Rates Unit */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-sky-400" />
              <div>
                <span className="font-bold text-white block">Spring Rates</span>
                <span className="text-[10px] text-gray-500">LBS/IN or KGF/MM or N/MM</span>
              </div>
            </div>
            <div className="flex rounded-lg bg-black/60 p-0.5 border border-white/10">
              <button
                onClick={() => setUnit('springs', 'lbs_in')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.springs === 'lbs_in' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                LBS/IN
              </button>
              <button
                onClick={() => setUnit('springs', 'kgf_mm')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.springs === 'kgf_mm' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                KGF/MM
              </button>
              <button
                onClick={() => setUnit('springs', 'n_mm')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.springs === 'n_mm' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                N/MM
              </button>
            </div>
          </div>

          {/* Weight Unit */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-pink-400" />
              <div>
                <span className="font-bold text-white block">Weight &amp; Downforce</span>
                <span className="text-[10px] text-gray-500">Pounds (LBS) or KG</span>
              </div>
            </div>
            <div className="flex rounded-lg bg-black/60 p-0.5 border border-white/10">
              <button
                onClick={() => setUnit('weight', 'lbs')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.weight === 'lbs' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                LBS
              </button>
              <button
                onClick={() => setUnit('weight', 'kg')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  units.weight === 'kg' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                KG
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* 3. TELEMETRY SOURCE MODE SELECTOR                                         */}
      {/* ========================================================================= */}
      <Card className="p-5 space-y-4 bg-[#0e0e16] border-white/10">
        <h2 className="text-sm sm:text-base font-bold border-b border-white/10 pb-2 flex items-center gap-2 font-mono">
          <Radio size={18} className="text-emerald-400" />
          <span>TELEMETRY SOURCE MODE</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {/* Real Game Mode */}
          <button
            onClick={() => handleSaveMode(false)}
            disabled={saving}
            className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
              !simulate 
                ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-[0_0_20px_rgba(0,255,136,0.15)]' 
                : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <div className="flex items-center gap-2">
                <Gamepad2 size={20} className={!simulate ? 'text-emerald-400' : 'text-gray-400'} />
                <span className="font-mono font-bold text-sm text-white">Forza Horizon (Live UDP)</span>
              </div>
              {!simulate && <CheckCircle2 size={18} className="text-emerald-400" />}
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed font-mono">
              Receives live telemetry packets directly from Forza Horizon 4, 5, 6 or Motorsport.
            </p>
          </button>

          {/* Simulator Mode */}
          <button
            onClick={() => handleSaveMode(true)}
            disabled={saving}
            className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
              simulate 
                ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.15)]' 
                : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <div className="flex items-center gap-2">
                <Cpu size={20} className={simulate ? 'text-cyan-400' : 'text-gray-400'} />
                <span className="font-mono font-bold text-sm text-white">Physics Simulator (Test)</span>
              </div>
              {simulate && <CheckCircle2 size={18} className="text-cyan-400" />}
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed font-mono">
              Generates simulated 60Hz driving physics, gear shifts, tire heat, and drag sprints for testing.
            </p>
          </button>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* 4. IN-GAME FORZA HORIZON CONNECTION SETUP                                  */}
      {/* ========================================================================= */}
      <Card className="p-5 space-y-4 border-emerald-500/30 bg-[#0e0e16]">
        <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Wifi size={18} className="text-emerald-400" />
            <h2 className="text-sm sm:text-base font-bold font-mono">Forza In-Game Data Out Setup</h2>
          </div>
          <button
            onClick={copyForzaSettings}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono font-bold text-gray-200 transition-colors cursor-pointer"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? 'Copied!' : 'Copy Settings'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 font-mono text-xs">
          {/* Setting 1: IP */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3.5 space-y-1">
            <span className="text-[9px] uppercase font-bold text-gray-400">1. Data Out IP Address (IPv4)</span>
            <div className="text-lg font-bold text-emerald-400">
              {getSuggestedForzaIp()}
            </div>
            <p className="text-[10px] text-gray-500">
              Enter this IP in Forza's HUD and Gameplay &gt; Data Out IP settings. (Forza requires an IPv4 address, not a domain name).
            </p>
          </div>

          {/* Setting 2: Port */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3.5 space-y-2">
            <span className="text-[9px] uppercase font-bold text-gray-400">2. Data Out IP Port</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={udpPort}
                onChange={(e) => setUdpPort(e.target.value)}
                className="w-28 bg-black border border-white/20 rounded px-2.5 py-1 text-base font-bold text-white outline-none focus:border-emerald-400"
              />
              <button
                onClick={handleSavePort}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[11px] uppercase cursor-pointer transition-colors"
              >
                Apply Port
              </button>
            </div>
          </div>
        </div>

        {/* 3-Tier Diagnostics Panel */}
        <div className="bg-black/40 rounded-xl p-4 border border-white/10 space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              TELEMETRY PIPELINE DIAGNOSTICS
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              Privacy-First Local Ingress
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* 1. Web Gateway */}
            <div className={`p-3 rounded-lg border ${connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">1. WEB GATEWAY</span>
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
              </div>
              <div className="text-sm font-black text-white">
                {connected ? 'CONNECTED' : 'DISCONNECTED'}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {connected ? `PWA linked to Local Bridge (${telemetryHost})` : 'Waiting for local Python bridge...'}
              </p>
            </div>

            {/* 2. UDP Receiver */}
            <div className={`p-3 rounded-lg border ${serverStatus?.udp_listening ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : (connected ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-black/40 border-white/10 text-gray-400')}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">2. UDP RECEIVER</span>
                <span className={`w-2 h-2 rounded-full ${serverStatus?.udp_listening ? 'bg-emerald-400' : 'bg-gray-600'}`} />
              </div>
              <div className="text-sm font-black text-white">
                {serverStatus?.udp_listening ? `LISTENING :${udpPort}` : 'STOPPED'}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Local datagram socket ready on 0.0.0.0:{udpPort}
              </p>
            </div>

            {/* 3. Forza Stream */}
            <div className={`p-3 rounded-lg border ${(serverStatus?.packet_rate_hz > 0 || serverStatus?.telemetry_state === 'RECEIVING') ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">3. FORZA TELEMETRY</span>
                <span className={`w-2 h-2 rounded-full ${(serverStatus?.packet_rate_hz > 0 || serverStatus?.telemetry_state === 'RECEIVING') ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              </div>
              <div className="text-sm font-black text-white">
                {serverStatus?.telemetry_state === 'RECEIVING' ? `${serverStatus?.packet_rate_hz || 60} HZ STREAMING` : (simulate ? 'SIMULATOR ACTIVE' : 'WAITING FOR FEED')}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Total Packets: {serverStatus?.packets_received?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="text-center text-[11px] text-gray-600 font-mono pt-2">
        GridPulse &copy; 2026 • Forza Horizon 4 / 5 / 6 &amp; Motorsport Telemetry Suite
      </div>
    </div>
  );
}
