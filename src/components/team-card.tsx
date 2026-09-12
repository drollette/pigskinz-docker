"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

interface TeamCardProps {
  team: {
    id: string;
    abbreviation: string;
    displayName?: string | null;
    logo?: string | null;
    score?: number | null;
    isWinner?: boolean;
  };
  completed?: boolean;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  /** Current user's avatar — only passed for the team they picked. */
  userAvatar?: string | null;
  userName?: string;
  /** Graded result of the user's pick, once the game is completed. */
  userPickCorrect?: boolean | null;
  /** Point spread (e.g. "-3.5"), shown under the abbreviation only for the
   * favored team so it's visually tied to the side it actually applies to. */
  spread?: string | null;
}

export function TeamCard({
  team,
  completed = false,
  selected = false,
  onClick,
  disabled = false,
  userAvatar,
  userName,
  userPickCorrect = null,
  spread,
}: TeamCardProps) {
  const isWinner = team.isWinner;
  const isFaded = completed && !isWinner;
  const isInteractive = !disabled && !completed;

  // Use ESPN CDN logo URL - external source to avoid copyright concerns
  const logoUrl = team.logo || `https://a.espncdn.com/i/teamlogos/nfl/500/${team.abbreviation.toLowerCase()}.png`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || completed}
      className={cn(
        "relative flex flex-col items-center rounded-lg transition-all duration-200",
        "p-3 @sm:p-4",
        "bg-base-100",
        isInteractive && "cursor-pointer hover:bg-base-200 hover:scale-105 active:scale-100",
        !isInteractive && "cursor-default",
        // Mutually exclusive border/background states (rather than stacking
        // e.g. border-2 with a conditional border-4) so the result doesn't
        // depend on Tailwind's generated CSS order to resolve the conflict.
        isWinner
          ? "border-2 border-success bg-success/10"
          : selected && !completed
            ? "border-4 border-primary bg-primary/20 ring-2 ring-primary/40 ring-offset-2 ring-offset-base-100"
            : "border-2 border-transparent",
        isFaded && "opacity-50"
      )}
    >
      {completed && userName && (
        <div
          className={cn(
            "absolute -top-1.5 -left-1.5 inline-flex w-6 h-6 rounded-full",
            "ring-2 ring-offset-2 ring-offset-base-100",
            userPickCorrect === true && "ring-success",
            userPickCorrect === false && "ring-error"
          )}
        >
          <Avatar name={userName} avatar={userAvatar} size="xs" />
          {userPickCorrect !== null && (
            <span
              className={cn(
                "absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 rounded-full p-0.5",
                "ring-2 ring-base-100",
                userPickCorrect
                  ? "bg-success text-success-content"
                  : "bg-error text-error-content"
              )}
            >
              {userPickCorrect ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
            </span>
          )}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={`${team.abbreviation} logo`}
        width={80}
        height={80}
        className="object-contain pointer-events-none w-14 h-14 @sm:w-20 @sm:h-20"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {team.displayName && (
        <div className="text-center mt-2 text-xs @sm:text-sm font-medium text-base-content">
          {team.abbreviation}
        </div>
      )}
      {spread && (
        <div className="text-center text-[10px] @sm:text-xs text-base-content/50">{spread}</div>
      )}
    </button>
  );
}
