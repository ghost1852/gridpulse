import { useState } from 'react';
import { 
  Gauge, 
  Download, 
  Wifi, 
  ShieldCheck, 
  Smartphone, 
  Copy, 
  Check, 
  ArrowRight, 
  ExternalLink,
  Layers,
  Activity,
  Flame,
  Radio,
  Sliders,
  Play
} from 'lucide-react';
import { Card } from '../components/ui/Card';

interface LandingPageProps {
  onOpenDashboard: () => void;
}

export function LandingPage({ onOpenDashboard }: LandingPageProps) {
  const [copied, setCopied] = useState(false);

  const copyForzaSettings = () => {
    const text = `Data Out: ON\nData Out IP Address: 127.0.0.1\nData Out IP Port: 20066\nData Out Packet Format: Car Dash`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-full bg-[#0a0a0f] text-white font-sans overflow-y-auto pb-32">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION                                                           */}
      {/* ========================================================================= */}
      <div className="relative border-b border-white/10 bg-gradient-to-b from-[#141422] via-[#0d0d16] to-[#0a0a0f] px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold tracking-wider">
            <Radio size={14} className="animate-pulse text-emerald-400" />
            <span>FORZA HORIZON 4, 5, 6 &amp; MOTORSPORT</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tight uppercase leading-none">
              GRID<span className="text-emerald-400">PULSE</span>
            </h1>
            <p className="text-base sm:text-xl text-gray-300 max-w-2xl font-mono leading-relaxed">
              Real-time 60Hz telemetry dashboard, drag strip timer &amp; chassis tuning bench for sim racers.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2 font-mono">
            <button
              onClick={onOpenDashboard}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm uppercase tracking-wider transition-all transform active:scale-95 shadow-[0_0_25px_rgba(0,255,136,0.35)] cursor-pointer"
            >
              <Play size={16} className="fill-black" />
              <span>Launch Live Dashboard</span>
            </button>

            <a
              href="/downloads/GridPulse-Bridge-Windows.zip"
              download="GridPulse-Bridge-Windows.zip"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-sm uppercase tracking-wider transition-all cursor-pointer hover:border-emerald-400"
            >
              <Download size={16} className="text-emerald-400" />
              <span>Download Windows Bridge (.EXE)</span>
            </a>
          </div>

          {/* Quick Specs Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 font-mono text-xs text-gray-400 border-t border-white/10">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>100% Local Privacy</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi size={16} className="text-cyan-400" />
              <span>Zero-VPS WebRTC</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-amber-400" />
              <span>60Hz Native Stream</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone size={16} className="text-rose-400" />
              <span>PWA Wheel Mount</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-12">
        {/* ========================================================================= */}
        {/* 2. THREE-STEP QUICK SETUP GUIDE                                           */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black font-mono tracking-wider text-white uppercase flex items-center gap-2">
              <Sliders className="text-emerald-400" />
              <span>HOW TO SET UP IN 60 SECONDS</span>
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              Follow these 3 easy steps to connect your PC or Xbox to your phone/dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
            {/* Step 1 */}
            <Card className="p-5 space-y-3 bg-[#0e0e16] border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-emerald-400">01</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20">
                  PC Bridge
                </span>
              </div>
              <h3 className="font-bold text-white text-base">Run GridPulse Bridge</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Download and unzip <strong>GridPulse-Bridge-Windows.zip</strong> on your gaming PC, then double-click <strong>GridPulse-Bridge.exe</strong>. No Python setup required!
              </p>
              <a
                href="/downloads/GridPulse-Bridge-Windows.zip"
                download="GridPulse-Bridge-Windows.zip"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-bold pt-1"
              >
                <Download size={13} />
                <span>Download .EXE (68 MB)</span>
              </a>
            </Card>

            {/* Step 2 */}
            <Card className="p-5 space-y-3 bg-[#0e0e16] border-emerald-500/40 relative overflow-hidden shadow-[0_0_20px_rgba(0,255,136,0.08)]">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-emerald-400">02</span>
                <button
                  onClick={copyForzaSettings}
                  className="flex items-center gap-1 text-[10px] bg-white/10 hover:bg-white/20 text-gray-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                >
                  {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <h3 className="font-bold text-white text-base">Turn on Forza Data Out</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                In Forza: <strong>Settings &gt; HUD &amp; Gameplay &gt; Telemetry</strong>:
              </p>
              <div className="bg-black/60 rounded p-2 text-[11px] text-gray-300 space-y-0.5 border border-white/5">
                <div>• Data Out: <strong className="text-emerald-400">ON</strong></div>
                <div>• Data Out IP: <strong className="text-emerald-400">127.0.0.1</strong></div>
                <div>• Data Out Port: <strong className="text-emerald-400">20066</strong></div>
                <div>• Packet Format: <strong className="text-emerald-400">Car Dash</strong></div>
              </div>
            </Card>

            {/* Step 3 */}
            <Card className="p-5 space-y-3 bg-[#0e0e16] border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-emerald-400">03</span>
                <span className="text-[10px] bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/20">
                  Phone / Wheel Mount
                </span>
              </div>
              <h3 className="font-bold text-white text-base">Pair &amp; Drive</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Scan the QR code shown in the bridge window with your phone, mount your phone to your steering wheel, and hit the track with live telemetry!
              </p>
              <button
                onClick={onOpenDashboard}
                className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold pt-1 cursor-pointer"
              >
                <span>Launch Dashboard</span>
                <ArrowRight size={13} />
              </button>
            </Card>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. CORE FEATURES & TOOLING                                                */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black font-mono tracking-wider text-white uppercase flex items-center gap-2">
            <Layers className="text-emerald-400" />
            <span>BUILT FOR SERIOUS DRIVERS &amp; TUNERS</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
            {/* Feature 1 */}
            <div className="bg-[#0e0e16] border border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Gauge size={18} />
                <span>60Hz Live Racing HUD</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                High-visibility digital speedometer, animated RPM shift lights with redline strobe, 4-corner tire thermal grids, and real-time lateral G-force circle.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#0e0e16] border border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <Flame size={18} />
                <span>Precision Drag Strip Engine</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Automatic staging detection, 0-60 MPH, 0-100 MPH, 60-130 MPH, 1/4 Mile with trap speed, and personal best garage leaderboards.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#0e0e16] border border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Sliders size={18} />
                <span>Chassis Tuning Diagnostics</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Live suspension stroke travel (meters &amp; normalized), tire slip ratio &amp; angle analysis, brake balance, and optimal tire thermal windows.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-[#0e0e16] border border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <ShieldCheck size={18} />
                <span>100% Privacy &amp; Offline PWA</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Your telemetry stays on your local device. Encrypted direct WebRTC / WebSocket channels ensure zero telemetry ever touches the cloud.
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. ABOUT GRIDPULSE & TECHNICAL ARCHITECTURE                               */}
        {/* ========================================================================= */}
        <Card className="p-6 bg-[#0e0e16] border-white/10 space-y-4 font-mono">
          <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Activity size={18} className="text-emerald-400" />
            <span>ABOUT GRIDPULSE</span>
          </h2>
          
          <p className="text-xs text-gray-300 leading-relaxed">
            GridPulse is an open-source motorsport telemetry platform engineered specifically for the <strong>Forza Horizon</strong> and <strong>Forza Motorsport</strong> series. 
            It intercepts the native 324-byte UDP data packet streamed directly from the game engine at 60 Hz, decodes high-frequency vehicle dynamics (suspension travel, tire surface temps, slip vectors, G-forces, RPM), and provides real-time driver telemetry.
          </p>

          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
            <span>GridPulse Telemetry Suite v2.1 • Motorsport Edition</span>
            <a
              href="https://github.com/ghost1852/gridpulse"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold"
            >
              <span>GitHub Repository</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
