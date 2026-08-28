import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  carClass: string;
}

export function Badge({ carClass, className, ...props }: BadgeProps) {
  const getBadgeColor = (c: string) => {
    switch (c?.toUpperCase()) {
      case 'D': return 'bg-gray-600 text-white';
      case 'C': return 'bg-blue-500 text-white';
      case 'B': return 'bg-yellow-500 text-black';
      case 'A': return 'bg-orange-500 text-black';
      case 'S1': return 'bg-red-500 text-white';
      case 'S2': return 'bg-purple-500 text-white';
      case 'R': return 'bg-cyan-400 text-black font-black shadow-[0_0_10px_rgba(34,211,238,0.5)]';
      case 'P': return 'bg-pink-500 text-white font-black';
      case 'X': return 'bg-[#00ff88] text-black font-black shadow-[0_0_10px_#00ff8880]';
      default: return 'bg-gray-800 text-gray-300';
    }
  };

  return (
    <span 
      className={cn(
        "px-2 py-0.5 rounded-full text-xs font-bold font-mono inline-flex items-center justify-center min-w-[28px]",
        getBadgeColor(carClass),
        className
      )}
      {...props}
    >
      {carClass || '?'}
    </span>
  );
}
