import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { useUnits } from '../context/UnitContext';
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
  Scale
} from 'lucide-react';

export function SettingsPage() {
  const [simulate, setSimulate] = useState(false);
  const [udpPort, setUdpPort] = useState('20066');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [serverStatus, setServerStatus] = useState<any>(null);

  const { units, setUnit } = useUnits();

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setSimulate(data.simulate);
        setUdpPort(String(data.udp_port));
        setServerStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(fetchConfig, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveMode = async (simMode: boolean) => {
    setSaving(true);
    try {
      await fetch('/api/config', {
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
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ udp_port: parseInt(udpPort, 10) })
      });
      await fetchConfig();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const copyForzaSettings = () => {
    const text = `IP: 127.0.0.1 (or ${window.location.hostname})\nPort: ${udpPort}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6 pb-36 landscape:pb-16">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-widest uppercase mb-1 font-mono">
          Settings &amp; Preferences
        </h1>
        <p className="text-gray-400 font-mono text-xs sm:text-sm">
          Granular unit configuration and Forza Horizon telemetry connection
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 1. GRANULAR UNIT CUSTOMIZATION MATRIX (Per-Metric Selection)             */}
      {/* ========================================================================= */}
      <Card className="p-5 space-y-4 bg-[#0e0e16] border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-emerald-400" />
            <h2 className="text-sm sm:text-base font-bold font-mono text-white uppercase">
              Individual Metric &amp; Imperial Unit Choices
            </h2>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            Auto-Saved
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 font-mono text-xs">
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
              <Thermometer size={16} className="text-red-400" />
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

          {/* Pressure Unit */}
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

          {/* Power Unit */}
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

          {/* Weight / Downforce */}
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
      {/* 2. TELEMETRY SOURCE MODE SELECTOR                                         */}
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
      {/* 3. IN-GAME FORZA HORIZON CONNECTION SETUP                                  */}
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
            <span className="text-[9px] uppercase font-bold text-gray-400">1. Data Out IP Address</span>
            <div className="text-lg font-bold text-emerald-400">
              {window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname}
            </div>
            <p className="text-[10px] text-gray-500">
              Enter this IP in Forza's HUD and Gameplay &gt; Data Out IP settings.
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

        {/* Live Packet Status */}
        <div className="bg-black/30 rounded-xl p-3 border border-white/5 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${serverStatus?.packets_received > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-gray-300">
              Packets Streamed: <strong className="text-white">{serverStatus?.packets_received?.toLocaleString() || 0}</strong>
            </span>
          </div>
          <span className="text-gray-400">
            Mode: <strong className={simulate ? 'text-cyan-400' : 'text-emerald-400'}>{simulate ? 'Simulator' : 'Live Forza'}</strong>
          </span>
        </div>
      </Card>

      <div className="text-center text-[11px] text-gray-600 font-mono pt-2">
        GridPulse &copy; 2026 • Forza Horizon 4 / 5 / 6 &amp; Motorsport Telemetry Suite
      </div>
    </div>
  );
}
