"use client";

import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeekTransitionPanelProps {
  currentWeek: number;
  currentSeasonType: number;
  children: ReactNode;
}

const MAX_WEEKS: Record<number, number> = { 1: 4, 2: 18, 3: 4 };

function nextSeasonType(seasonType: number): number {
  return seasonType === 1 ? 2 : seasonType === 2 ? 3 : 1;
}

function prevSeasonType(seasonType: number): number {
  return seasonType === 1 ? 3 : seasonType === 2 ? 1 : 2;
}

/** Owns the "‹ Week N ›" heading + week navigation (moved here from the
 * old combined week+season nav row, see PoolStandingsHeader), and slides
 * its `children` in from the direction you navigated -- left arrow slides
 * the new week in from the left, right arrow from the right.
 *
 * Direction is a ref, not state: mutating it must not itself trigger a
 * re-render, or that render would apply the new animation class to the
 * div that's *still showing the old week* (same key, since the URL hasn't
 * actually changed yet), playing the slide once on stale content --  then
 * again when the new week's data lands and the key below actually changes.
 * A ref just sits there until that second, real re-render reads it. */
export function WeekTransitionPanel({ currentWeek, currentSeasonType, children }: WeekTransitionPanelProps) {
  const router = useRouter();
  const directionRef = useRef<"prev" | "next">("next");

  const navigate = (dir: "prev" | "next") => {
    let newWeek = currentWeek;
    let newSeasonType = currentSeasonType;
    const maxWeeks = MAX_WEEKS[currentSeasonType] ?? 18;

    if (dir === "next") {
      if (currentWeek >= maxWeeks) {
        newSeasonType = nextSeasonType(currentSeasonType);
        newWeek = 1;
      } else {
        newWeek = currentWeek + 1;
      }
    } else {
      if (currentWeek === 1) {
        newSeasonType = prevSeasonType(currentSeasonType);
        newWeek = MAX_WEEKS[newSeasonType] ?? 18;
      } else {
        newWeek = currentWeek - 1;
      }
    }

    directionRef.current = dir;
    // scroll: false -- the arrows sit inline in the page, not at the top,
    // so the default scroll-to-top-on-navigate behavior yanked the reader
    // away from where they were reading every time they tapped one.
    router.push(`/?seasonType=${newSeasonType}&week=${newWeek}`, { scroll: false });
  };

  return (
    <>
      <div className="w-full max-w-3xl mb-3">
        <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("prev")}
            className="btn btn-ghost btn-xs btn-circle"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          Week {currentWeek}
          <button
            type="button"
            onClick={() => navigate("next")}
            className="btn btn-ghost btn-xs btn-circle"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </h2>
      </div>

      <div
        key={`${currentSeasonType}-${currentWeek}`}
        className={cn(
          "w-full flex flex-col items-center",
          directionRef.current === "prev" ? "animate-week-slide-from-left" : "animate-week-slide-from-right"
        )}
      >
        {children}
      </div>
    </>
  );
}
