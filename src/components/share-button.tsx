"use client";

import { Share2 } from "lucide-react";
import { shareApp } from "@/lib/share";

export function ShareButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={shareApp}
      aria-label="Share Pigskinz"
      className={className ?? "btn btn-ghost btn-sm gap-2 text-base-content/60"}
    >
      <Share2 className="w-4 h-4" />
      Share
    </button>
  );
}
