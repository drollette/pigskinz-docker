"use client";

import { useState } from "react";
import { PlayerCompareModal, type RosterEntry } from "@/components/player-compare-modal";

interface PlayerCompareTriggerProps {
  currentUserId: string;
  seasonType: number;
  roster: RosterEntry[];
}

// A single "Details" button, meant to sit alongside the season standings
// title, that opens the points-comparison modal seeded with just the
// logged-in user -- they add other players to compare against from the
// modal's own picker.
export function PlayerCompareTrigger({ currentUserId, seasonType, roster }: PlayerCompareTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-outline btn-xs"
        title="Compare your points against other players"
      >
        Details
      </button>
      <PlayerCompareModal
        open={open}
        onClose={() => setOpen(false)}
        seasonType={seasonType}
        roster={roster}
        initialUserIds={open ? [currentUserId] : []}
      />
    </>
  );
}
