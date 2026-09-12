"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  targetDate: Date | string;
  label: string;
}

function getTimeParts(msRemaining: number) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/**
 * Live countdown to a target date, ticking once a second. Renders nothing
 * once the target has passed — the caller decides what (if anything) to
 * show instead.
 */
export function CountdownTimer({ targetDate, label }: CountdownTimerProps) {
  const target = new Date(targetDate).getTime();
  const [msRemaining, setMsRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setMsRemaining(target - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (msRemaining <= 0) return null;

  const { days, hours, minutes, seconds } = getTimeParts(msRemaining);

  return (
    <div className="@container flex items-center justify-center gap-3 rounded-lg bg-primary/10 border border-primary/20 px-4 py-3">
      <Clock className="w-5 h-5 text-primary shrink-0" />
      <div className="text-center">
        <div className="text-xs text-base-content/60">{label}</div>
        <div className="font-mono font-semibold text-base @sm:text-lg tabular-nums">
          {days}d {String(hours).padStart(2, "0")}h {String(minutes).padStart(2, "0")}m{" "}
          {String(seconds).padStart(2, "0")}s
        </div>
      </div>
    </div>
  );
}
