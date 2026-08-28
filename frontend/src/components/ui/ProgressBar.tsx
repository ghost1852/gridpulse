import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  color?: string;
  orientation?: 'horizontal' | 'vertical';
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({ 
  value, 
  color = 'var(--color-accent-primary)', 
  orientation = 'horizontal',
  showLabel = false,
  label,
  className,
  ...props 
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const isVertical = orientation === 'vertical';

  return (
    <div className={cn("flex flex-col items-center gap-1", className)} {...props}>
      <div 
        className={cn(
          "bg-white/10 rounded-full overflow-hidden relative",
          isVertical ? "w-4 h-full" : "w-full h-4"
        )}
      >
        <motion.div
          className="absolute rounded-full"
          style={{ backgroundColor: color }}
          initial={isVertical ? { height: '0%', bottom: 0, width: '100%' } : { width: '0%', left: 0, height: '100%' }}
          animate={isVertical ? { height: `${clampedValue}%` } : { width: `${clampedValue}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </div>
      {showLabel && label && (
        <span className="text-[10px] text-gray-400 font-mono uppercase font-bold tracking-wider">{label}</span>
      )}
    </div>
  );
}
