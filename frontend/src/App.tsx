import { useState } from 'react';
import { HudPage } from './pages/HudPage';
import { DynoPage } from './pages/DynoPage';
import { RaceAnalyzePage } from './pages/RaceAnalyzePage';
import { TuningBenchPage } from './pages/TuningBenchPage';
import { VehicleStatsPage } from './pages/VehicleStatsPage';
import { DragStripPage } from './pages/DragStripPage';
import { SettingsPage } from './pages/SettingsPage';
import { LandingPage } from './pages/LandingPage';
import { useTelemetry } from './hooks/useTelemetry';
import { Gauge, Zap, LineChart, Wrench, Activity, Flag, Settings, Radio, BookOpen, Download } from 'lucide-react';
import { cn } from './lib/utils';

export function App() {
  const [activeTab, setActiveTab] = useState<'hud' | 'dyno' | 'analyze' | 'tuning' | 'stats' | 'drag' | 'guide' | 'settings'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('code')) {
          return 'hud';
        }
      }
    } catch {}
    return 'guide';
  });
  const { connected, transportLabel } = useTelemetry();

  const tabs = [
    { id: 'hud' as const, label: 'HUD', icon: Gauge },
    { id: 'dyno' as const, label: 'Dyno', icon: Zap },
    { id: 'analyze' as const, label: 'Analyze', icon: LineChart },
    { id: 'tuning' as const, label: 'Tuning', icon: Wrench },
    { id: 'stats' as const, label: 'Vehicle', icon: Activity },
    { id: 'drag' as const, label: 'Drag', icon: Flag },
    { id: 'guide' as const, label: 'Guide', icon: BookOpen },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0f] text-white font-sans overflow-hidden">
      {/* Desktop Sidebar Navigation (Hidden on mobile & mobile landscape) */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#111118] border-r border-white/5 shrink-0 z-40">
        {/* Brand */}
        <div className="p-5 flex items-center justify-between border-b border-white/5">
          <div 
            onClick={() => setActiveTab('guide')}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-3 h-3 rounded-full bg-[var(--color-accent-primary)] shadow-[0_0_10px_#00ff88]" />
            <span className="font-mono font-black text-lg tracking-wider bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              GRIDPULSE
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono">
            <Radio size={10} className={connected ? "text-emerald-400 animate-pulse" : "text-yellow-400"} />
            <span className="text-gray-400">{connected ? "60Hz" : "OFFLINE"}</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onPointerDown={() => setActiveTab(tab.id)}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-mono transition-all cursor-pointer touch-manipulation",
                activeTab === tab.id
                  ? "bg-gradient-to-r from-[var(--color-accent-primary)]/15 to-transparent text-[var(--color-accent-primary)] border-l-2 border-[var(--color-accent-primary)] font-bold shadow-[inset_0_0_15px_rgba(0,255,136,0.05)]"
                  : "text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10"
              )}
            >
              <tab.icon size={18} className={activeTab === tab.id ? "text-[var(--color-accent-primary)]" : "text-gray-400"} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Download Bridge CTA */}
        <div className="p-3 border-t border-white/5">
          <a
            href="https://github.com/ghost1852/gridpulse/releases/download/v2.1.0/GridPulse-Bridge-Windows.zip"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold transition-all shadow-[0_0_15px_rgba(0,255,136,0.08)]"
          >
            <Download size={14} />
            <span>Windows Bridge (.EXE)</span>
          </a>
        </div>

        {/* Desktop Footer Status */}
        <div className="p-3 border-t border-white/5 text-[11px] font-mono text-gray-500">
          <div>Status: <span className={connected ? "text-emerald-400 font-bold" : "text-yellow-400"}>{transportLabel}</span></div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-y-auto min-h-0 bg-gradient-to-br from-[#0a0a0f] to-[#111118]">
        {/* Clean Non-Overlapping Landscape Top Bar */}
        <header className="hidden landscape:flex lg:landscape:hidden items-center justify-between px-3 py-1 bg-[#0a0a10]/95 border-b border-white/10 shrink-0 z-40">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", connected ? "bg-emerald-400 shadow-[0_0_8px_#00ff88]" : "bg-amber-400")} />
            <span className="font-mono font-black text-xs tracking-wider text-white">GRIDPULSE</span>
            <span className="text-[9px] font-mono text-emerald-400 font-bold ml-1">{transportLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onPointerDown={() => setActiveTab(tab.id)}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer",
                  activeTab === tab.id
                    ? "bg-emerald-500 text-black shadow-[0_0_10px_#00ff88]"
                    : "text-gray-400 hover:text-white bg-white/5"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {activeTab === 'hud' && <HudPage />}
        {activeTab === 'dyno' && <DynoPage />}
        {activeTab === 'analyze' && <RaceAnalyzePage />}
        {activeTab === 'tuning' && <TuningBenchPage />}
        {activeTab === 'stats' && <VehicleStatsPage />}
        {activeTab === 'drag' && <DragStripPage />}
        {activeTab === 'guide' && <LandingPage onOpenDashboard={() => setActiveTab('hud')} />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      {/* Mobile Portrait Bottom Navigation Bar (Hidden in landscape) */}
      <nav className="lg:hidden landscape:hidden fixed bottom-0 inset-x-0 h-16 bg-[#0a0a0f]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-around px-1 z-50 safe-area-pb">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onPointerDown={() => setActiveTab(tab.id)}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors cursor-pointer py-1 touch-manipulation active:scale-95",
              activeTab === tab.id ? "text-[var(--color-accent-primary)] font-bold" : "text-gray-400 active:text-gray-200"
            )}
          >
            <tab.icon size={17} className={activeTab === tab.id ? "text-[var(--color-accent-primary)]" : "text-gray-400"} />
            <span className="text-[9px] font-mono tracking-tight">{tab.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
