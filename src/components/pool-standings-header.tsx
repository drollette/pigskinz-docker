"use client";

import { useRouter } from "next/navigation";
import { blackOpsOne } from "@/lib/fonts";

interface PoolStandingsHeaderProps {
  currentSeasonType: number;
}

const SEASON_TYPE_LABELS: Record<number, string> = {
  1: "Preseason",
  2: "Regular Season",
  3: "Playoffs",
};

// The page title + season-type switcher. Week navigation used to live in
// this same row (as arrows either side of "Week N"), but now lives inline
// with the "Week N" section heading instead -- see WeekTransitionPanel.
export function PoolStandingsHeader({ currentSeasonType }: PoolStandingsHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-4 mb-6">
      {/* lg+ gets this heading from the column's own dropdown header instead
          (see PanelSelect) -- below that there's no header row at all, so
          this is the only page title a phone gets. Just "Standings" (not
          "Pool Standings") so it stays on one line next to the dropdown
          rather than wrapping and pushing the dropdown off-row. */}
      <h1 className="lg:hidden text-2xl font-bold text-base-content">Standings</h1>
      {/* Styled like a heading (blackOpsOne stencil font + uppercase, same
          as every h1/h2/h3 gets globally) rather than a plain form select,
          since it sits right where a page title would be -- same treatment
          PanelSelect gives its own column-header dropdown elsewhere. */}
      <select
        className={`${blackOpsOne.className} select select-ghost px-0 text-lg uppercase tracking-wide text-base-content ml-auto`}
        value={currentSeasonType}
        onChange={(e) => router.push(`/?seasonType=${e.target.value}&week=1`, { scroll: false })}
        aria-label="Season type"
      >
        {Object.entries(SEASON_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value} className={`${blackOpsOne.className} bg-base-100 text-base-content`}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
