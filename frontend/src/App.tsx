import { useState } from 'react';
import { HudPage } from './pages/HudPage';
import { TuningBenchPage } from './pages/TuningBenchPage';
import { VehicleStatsPage } from './pages/VehicleStatsPage';
import { DragStripPage } from './pages/DragStripPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { useTelemetry } from './hooks/useTelemetry';
import { Gauge, Wrench, Activity, Flag, Trophy, Settings, Radio } from 'lucide-react';
import { cn } from './lib/utils';

export function App() {
  const [activeTab, setActiveTab] = useState<'hud' | 'tuning' | 'stats' | 'drag' | 'leaderboard' | 'settings'>('hud');
  const { connected } = useTelemetry();

  const tabs = [
    { id: 'hud' as const, label: 'HUD', icon: Gauge },
    { id: 'tuning' as const, label: 'Tuning', icon: Wrench },
    { id: 'stats' as const, label: 'Vehicle Stats', icon: Activity },
    { id: 'drag' as const, label: 'Drag Strip', icon: Flag },
    { id: 'leaderboard' as const, label: 'Leaderboard', icon: Trophy },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0f] text-white font-sans overflow-hidden">
      {/* Desktop Sidebar Navigation (Hidden on mobile & mobile landscape) */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#111118] border-r border-white/5 shrink-0 z-40">
        {/* Brand */}
        <div className="p-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2.5">
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

        {/* Desktop Footer Status */}
        <div className="p-4 border-t border-white/5 text-[11px] font-mono text-gray-500">
          <div>Status: <span className={connected ? "text-emerald-400" : "text-yellow-400"}>{connected ? "Receiving UDP" : "Waiting for stream"}</span></div>
        </div>
      </aside>

      {/* Main Content Area (Always scrollable in all orientations) */}
      <main className="flex-1 relative overflow-y-auto min-h-0 bg-gradient-to-br from-[#0a0a0f] to-[#111118]">
        {/* Floating Landscape Mode Tab Switcher Bar (Top Right) */}
        <div className="hidden landscape:flex lg:landscape:hidden sticky top-2 z-50 justify-end px-3 pointer-events-none mb-1">
          <div className="bg-black/85 backdrop-blur-md border border-white/15 rounded-xl p-1 flex gap-1 shadow-2xl pointer-events-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onPointerDown={() => setActiveTab(tab.id)}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer flex items-center gap-1 touch-manipulation",
                  activeTab === tab.id
                    ? "bg-emerald-500 text-black font-bold shadow-[0_0_10px_#00ff88]"
                    : "text-gray-400 hover:text-white active:bg-white/10"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'hud' && <HudPage />}
        {activeTab === 'tuning' && <TuningBenchPage />}
        {activeTab === 'stats' && <VehicleStatsPage />}
        {activeTab === 'drag' && <DragStripPage />}
        {activeTab === 'leaderboard' && <LeaderboardPage />}
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
            <tab.icon size={18} className={activeTab === tab.id ? "text-[var(--color-accent-primary)]" : "text-gray-400"} />
            <span className="text-[9px] font-mono tracking-tight">{tab.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
