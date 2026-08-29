import { useState } from 'react';
import { 
  Download, 
  Wifi, 
  ShieldCheck, 
  Smartphone, 
  Copy, 
  Check, 
  Activity,
  Radio,
  Sliders,
  Play,
  QrCode,
  Disc,
  Compass,
  FileCode2,
  Lock
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { copyTextToClipboard } from '../lib/clipboard';

interface LandingPageProps {
  onOpenDashboard: () => void;
}

export function LandingPage({ onOpenDashboard }: LandingPageProps) {
  const [copied, setCopied] = useState(false);

  const copyForzaSettings = async () => {
    const text = `Data Out: ON\nData Out IP Address: 127.0.0.1\nData Out IP Port: 20066\nData Out Packet Format: Car Dash`;
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-full bg-[#0a0a0f] text-white font-sans overflow-y-auto pb-32">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION                                                           */}
      {/* ========================================================================= */}
      <div className="relative border-b border-white/10 bg-gradient-to-b from-[#141422] via-[#0d0d16] to-[#0a0a0f] px-4 sm:px-8 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold tracking-wider">
            <Radio size={14} className="animate-pulse text-emerald-400" />
            <span>FORZA HORIZON TELEMETRY</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tight uppercase leading-none">
              GRID<span className="text-emerald-400">PULSE</span>
            </h1>
            <p className="text-sm sm:text-lg text-gray-300 max-w-2xl font-mono leading-relaxed">
              High-frequency telemetry instrument, virtual chassis dyno, dynamic balance monitor &amp; tuning advisor.
            </p>
          </div>

          {/* Quick Architectural Callout */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 max-w-3xl text-xs font-mono text-emerald-300 flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white uppercase tracking-wider block mb-0.5">100% Local-First LAN Architecture</span>
              GridPulse runs strictly on your local home network. Telemetry streams directly from Forza UDP into your browser over fast local WebSockets with sub-millisecond latency. <strong>Zero cloud telemetry relays or external dependencies.</strong>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2 font-mono">
            <button
              onClick={onOpenDashboard}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm uppercase tracking-wider transition-all transform active:scale-95 shadow-[0_0_25px_rgba(0,255,136,0.35)] cursor-pointer"
            >
              <Play size={16} className="fill-black" />
              <span>Launch Cockpit HUD</span>
            </button>

            <a
              href="/GridPulse-Bridge-Windows.zip"
              download="GridPulse-Bridge-Windows.zip"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-sm uppercase tracking-wider transition-all cursor-pointer hover:border-emerald-400"
            >
              <Download size={16} className="text-emerald-400" />
              <span>Download Windows Bridge (.ZIP)</span>
            </a>
          </div>

          {/* Quick Specs Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 font-mono text-xs text-gray-400 border-t border-white/10">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-emerald-400" />
              <span>100% Local LAN</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi size={15} className="text-cyan-400" />
              <span>Direct WebSocket Stream</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-amber-400" />
              <span>High-Frequency (60–100Hz)</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone size={15} className="text-rose-400" />
              <span>Sub-1ms Local Latency</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-10">
        {/* ========================================================================= */}
        {/* 2. THREE-STEP QUICK SETUP GUIDE                                           */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-mono font-black tracking-wider text-white uppercase">
              Quick Start Setup (60 Seconds)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
            {/* Step 1 */}
            <Card className="p-4 bg-[#101018] border-white/10 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">STEP 1</span>
                  <Download size={16} className="text-gray-400" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase">Run Bridge.exe</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Download and run <span className="text-white font-bold">GridPulse-Bridge.exe</span> on your gaming PC. It opens the local UDP port 20066 and displays a local QR code and URL.
                </p>
              </div>
              <a
                href="/GridPulse-Bridge-Windows.zip"
                download="GridPulse-Bridge-Windows.zip"
                className="flex items-center justify-center gap-1.5 w-full py-1.5 px-2.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 transition-colors cursor-pointer text-center"
              >
                <Download size={13} />
                <span>Download Bridge (.ZIP)</span>
              </a>
            </Card>

            {/* Step 2 */}
            <Card className="p-4 bg-[#101018] border-white/10 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">STEP 2</span>
                  <Sliders size={16} className="text-gray-400" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase">Configure Forza</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  In Forza Settings &gt; HUD and Gameplay &gt; Telemetry, turn <span className="text-white font-bold">Data Out ON</span> on IP <span className="text-white font-bold">127.0.0.1</span> and port <span className="text-white font-bold">20066</span>.
                </p>
              </div>
              <button
                onClick={copyForzaSettings}
                className="flex items-center justify-center gap-1.5 w-full py-1.5 px-2.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copied ? 'Copied Settings!' : 'Copy Forza Settings'}</span>
              </button>
            </Card>

            {/* Step 3 */}
            <Card className="p-4 bg-[#101018] border-white/10 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">STEP 3</span>
                  <QrCode size={16} className="text-gray-400" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase">Scan &amp; Mount Phone</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Scan the terminal QR code with your phone camera (or navigate to <span className="text-white font-bold">http://&lt;PC-IP&gt;:8000</span>). Telemetry streams at 60Hz immediately!
                </p>
              </div>
              <div className="text-[10px] text-gray-500 bg-black/40 p-2 rounded border border-white/5">
                Add to Home Screen on iOS Safari / Android Chrome for fullscreen HUD.
              </div>
            </Card>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. ARCHITECTURAL HIGHLIGHTS                                               */}
        {/* ========================================================================= */}
        <div className="space-y-4 font-mono">
          <h2 className="text-xl font-black tracking-wider text-white uppercase">
            Instrument Capabilities &amp; Engineering
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Direct Local LAN & WebSocket Engine */}
            <Card className="p-4 bg-[#101018] border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <Wifi size={18} />
                <h3 className="text-sm font-black text-white uppercase">Direct Local LAN &amp; WebSocket Engine</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Telemetry streams over low-latency binary WebSockets directly between your PC and phone on your local Wi-Fi with sub-millisecond responsiveness. 100% offline, zero cloud servers required.
              </p>
            </Card>

            {/* Dynamic Chassis Balance */}
            <Card className="p-4 bg-[#101018] border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400">
                <Compass size={18} />
                <h3 className="text-sm font-black text-white uppercase">Chassis Balance &amp; Slip Differential</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Calculates real-time understeer vs oversteer balance (Δα = α_rear - α_front), friction envelope traction utilization %, and detects wheelspin, axle lockups, and suspension bottoming spikes.
              </p>
            </Card>

            {/* 660-Car Offline Identification Database */}
            <Card className="p-4 bg-[#101018] border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-amber-400">
                <Disc size={18} />
                <h3 className="text-sm font-black text-white uppercase">660-Car Offline Database</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Complete offline vehicle dictionary mapping 660 Forza Horizon 6 ordinals (e.g. #3767 Acura NSX Type S, #383 BMW M3 E46) with zero runtime API calls or cloud queries.
              </p>
            </Card>

            {/* Virtual Chassis Dyno & Multi-Gear Thrust Lab */}
            <Card className="p-4 bg-[#101018] border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-yellow-400">
                <Radio size={18} />
                <h3 className="text-sm font-black text-white uppercase">Virtual Chassis Dyno &amp; Thrust Lab</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Automated WOT pull assistant with 100-RPM binning, 5,252 RPM crossover verification, multi-gear power thrust slices, and transmission shift point recommendations.
              </p>
            </Card>

            {/* Session Type System & Impact Logger */}
            <Card className="p-4 bg-[#101018] border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-pink-400">
                <Activity size={18} />
                <h3 className="text-sm font-black text-white uppercase">Session Modes &amp; Impact Logger</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Intelligent auto-detection for Drift, Time Attack, Circuit, Sprint, and Off-Road stints, with physics-based wall/barrier collision detection recording peak impact G-forces.
              </p>
            </Card>

            {/* Telemetry-Driven Mechanical Tuning Advisor */}
            <Card className="p-4 bg-[#101018] border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-purple-400">
                <Sliders size={18} />
                <h3 className="text-sm font-black text-white uppercase">Telemetry Tuning Advisor</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Replaces arbitrary guessing with concrete directional adjustments (▲ Increase Rear Lock, ▼ Soften Front ARB, ▲ Stiffen Springs) based on physical vehicle dynamics observations.
              </p>
            </Card>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. TECHNICAL DOCUMENTATION LINKS                                          */}
        {/* ========================================================================= */}
        <Card className="p-5 bg-gradient-to-r from-[#11111e] to-[#0c0c14] border-white/10 space-y-3 font-mono">
          <div className="flex items-center gap-2">
            <FileCode2 size={18} className="text-cyan-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Technical Documentation in Repository
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-black/40 rounded-lg border border-white/5">
              <span className="font-bold text-white block">docs/architecture.md</span>
              <span className="text-gray-400 text-[11px]">Local LAN vs WebSocket engine architecture</span>
            </div>
            <div className="p-2.5 bg-black/40 rounded-lg border border-white/5">
              <span className="font-bold text-white block">docs/dyno.md</span>
              <span className="text-gray-400 text-[11px]">Virtual chassis dyno &amp; thrust sweep calculations</span>
            </div>
            <div className="p-2.5 bg-black/40 rounded-lg border border-white/5">
              <span className="font-bold text-white block">docs/tuning.md</span>
              <span className="text-gray-400 text-[11px]">Mechanical tuning advisor &amp; alignment physics</span>
            </div>
            <div className="p-2.5 bg-black/40 rounded-lg border border-white/5">
              <span className="font-bold text-white block">docs/telemetry.md</span>
              <span className="text-gray-400 text-[11px]">324B UDP packet mapping, derived metrics &amp; heuristics</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
