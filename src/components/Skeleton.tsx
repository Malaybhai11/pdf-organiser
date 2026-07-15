import React from 'react';
import { cn } from '../utils/cn';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  count?: number;
}

export function Skeleton({ className, variant = 'text', width, height, count = 1 }: SkeletonProps) {
  const baseClass = 'animate-pulse bg-zinc-800 rounded';
  const variants = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(baseClass, variants[variant], className)}
          style={{ width, height }}
        />
      ))}
    </>
  );
}
