import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  glowColor?: string;
}

export function Card({ className, active, glowColor = 'var(--color-accent-primary)', children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-[var(--color-bg-card)] rounded-xl border border-white/5 shadow-lg overflow-hidden transition-all duration-300",
        active && "border-[var(--color-accent-primary)]/50",
        className
      )}
      style={{
        boxShadow: active ? `0 0 20px ${glowColor}20, inset 0 0 10px ${glowColor}10` : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
