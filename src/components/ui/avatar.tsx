"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/utils";

interface AvatarProps {
  name: string;
  avatar?: string | null;
  /** Stable per-user identifier (username or id) for the generated fallback
   * avatar, so it doesn't change on every page load. Falls back to `name`. */
  seed?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASSES = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
};

const IMAGE_SIZES = { xs: 24, sm: 32, md: 40, lg: 64, xl: 96 };

const TEXT_SIZE_CLASSES = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
  xl: "text-4xl",
};

// A handful of daisyUI-safe background colors, picked deterministically from
// the seed so the same person always lands on the same color rather than a
// random one on every render.
const FALLBACK_COLORS = [
  "bg-primary text-primary-content",
  "bg-secondary text-secondary-content",
  "bg-accent text-accent-content",
  "bg-info text-info-content",
  "bg-success text-success-content",
  "bg-warning text-warning-content",
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function Avatar({ name, avatar, seed, size = "md", className }: AvatarProps) {
  // The identicon fallback (getAvatarUrl) comes from a third-party API
  // (DiceBear) with no uptime guarantee -- if it 404s/times out, fall back
  // again to a purely local initials badge instead of a broken-image icon.
  const [imageFailed, setImageFailed] = useState(false);

  const effectiveSeed = seed || name;
  const avatarUrl = getAvatarUrl(effectiveSeed, avatar);
  const isDataUrl = avatarUrl.startsWith("data:");

  if (imageFailed) {
    const initial = name.trim().charAt(0).toUpperCase() || "?";
    const colorClass = FALLBACK_COLORS[hashSeed(effectiveSeed) % FALLBACK_COLORS.length];
    return (
      <div className={cn("avatar avatar-placeholder", className)}>
        <div className={cn("rounded-full flex items-center justify-center", SIZE_CLASSES[size], colorClass)}>
          <span className={cn("font-semibold", TEXT_SIZE_CLASSES[size])}>{initial}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("avatar", className)}>
      <div className={cn("rounded-full", SIZE_CLASSES[size])}>
        {isDataUrl ? (
          // Use regular img for data URLs (Next.js Image doesn't optimize data URLs)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={`${name}'s avatar`}
            width={IMAGE_SIZES[size]}
            height={IMAGE_SIZES[size]}
            className="rounded-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Image
            src={avatarUrl}
            alt={`${name}'s avatar`}
            width={IMAGE_SIZES[size]}
            height={IMAGE_SIZES[size]}
            className="rounded-full"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>
    </div>
  );
}
