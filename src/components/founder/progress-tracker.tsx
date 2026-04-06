"use client";

import { Progress } from "@/components/ui/progress";

interface ProgressTrackerProps {
  completed: number;
  total: number;
  label?: string;
  className?: string;
}

export function ProgressTracker({
  completed,
  total,
  label = "Progress",
  className = "",
}: ProgressTrackerProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {completed}/{total} modules
          {percentage > 0 && (
            <span className="text-muted-foreground ml-1">({percentage}%)</span>
          )}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}
