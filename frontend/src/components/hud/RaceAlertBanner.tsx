import { useState, useEffect, useRef } from 'react';
import { AlertOctagon, Flame, ShieldAlert, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

interface RaceAlertBannerProps {
  tireTempFl: number;
  tireTempFr: number;
  tireTempRl: number;
  tireTempRr: number;
  suspFl: number;
  suspFr: number;
  suspRl: number;
  suspRr: number;
  slipFl: number;
  slipFr: number;
  slipRl?: number;
  slipRr?: number;
  currentRpm: number;
  maxRpm: number;
  brake: number;
}

interface AlertState {
  type: 'danger' | 'warning';
  icon: ReactNode;
  text: string;
}

export function RaceAlertBanner({
  tireTempFl,
  tireTempFr,
  tireTempRl,
  tireTempRr,
  suspFl,
  suspFr,
  suspRl,
  suspRr,
  slipFl,
  slipFr,
  currentRpm,
  maxRpm,
  brake,
}: RaceAlertBannerProps) {
  const [displayedAlert, setDisplayedAlert] = useState<AlertState | null>(null);
  const holdUntilRef = useRef<number>(0);

  useEffect(() => {
    let newAlert: AlertState | null = null;

    if (suspFl < 0.03) newAlert = { type: 'danger', icon: <AlertOctagon size={13} />, text: 'FRONT-LEFT SUSPENSION BOTTOMED OUT' };
    else if (suspFr < 0.03) newAlert = { type: 'danger', icon: <AlertOctagon size={13} />, text: 'FRONT-RIGHT SUSPENSION BOTTOMED OUT' };
    else if (suspRl < 0.03) newAlert = { type: 'danger', icon: <AlertOctagon size={13} />, text: 'REAR-LEFT SUSPENSION BOTTOMED OUT' };
    else if (suspRr < 0.03) newAlert = { type: 'danger', icon: <AlertOctagon size={13} />, text: 'REAR-RIGHT SUSPENSION BOTTOMED OUT' };

    const maxT = Math.max(tireTempFl, tireTempFr, tireTempRl, tireTempRr);
    if (!newAlert && maxT >= 245) {
      newAlert = { type: 'danger', icon: <Flame size={13} />, text: `TIRE OVERHEAT: ${Math.round(maxT)}°F - REDUCE SLIP` };
    }

    if (!newAlert && brake > 230 && (slipFl > 1.6 || slipFr > 1.6)) {
      newAlert = { type: 'warning', icon: <ShieldAlert size={13} />, text: 'BRAKE LOCKUP DETECTED' };
    }

    if (!newAlert && currentRpm > 0 && maxRpm > 0 && currentRpm >= maxRpm * 0.99) {
      newAlert = { type: 'warning', icon: <Zap size={13} />, text: 'REV LIMITER - UPSHIFT' };
    }

    const now = Date.now();

    if (newAlert) {
      holdUntilRef.current = now + 2500;
      setDisplayedAlert(newAlert);
    } else if (now >= holdUntilRef.current) {
      setDisplayedAlert(null);
    }
  }, [tireTempFl, tireTempFr, tireTempRl, tireTempRr, suspFl, suspFr, suspRl, suspRr, slipFl, slipFr, currentRpm, maxRpm, brake]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() >= holdUntilRef.current && displayedAlert) {
        setDisplayedAlert(null);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [displayedAlert]);

  return (
    <div className="h-6 w-full flex items-center justify-center overflow-hidden">
      {displayedAlert ? (
        <div
          className={`w-full max-w-lg px-3 py-0.5 rounded text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-opacity duration-200 ${
            displayedAlert.type === 'danger'
              ? 'bg-red-600/25 border border-red-500/50 text-red-300'
              : 'bg-amber-500/25 border border-amber-500/50 text-amber-300'
          }`}
        >
          {displayedAlert.icon}
          <span>{displayedAlert.text}</span>
        </div>
      ) : (
        <div className="text-[10px] font-mono text-gray-600 tracking-wider">
          LIVE TELEMETRY ACTIVE • OPTIMAL SYSTEMS
        </div>
      )}
    </div>
  );
}
