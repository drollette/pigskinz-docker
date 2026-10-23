"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { Modal, ModalTitle, ModalActions } from "@/components/ui/modal";
import { WeeklyPerformanceChart, COLORS } from "@/components/standings-charts";
import { getPointsProgressionAction } from "@/app/actions";
import type { UserPointsProgression } from "@/lib/data";

export interface RosterEntry {
  userId: string;
  userName: string | null;
  username: string | null;
  avatar: string | null;
}

interface PlayerCompareModalProps {
  open: boolean;
  onClose: () => void;
  seasonType: number;
  roster: RosterEntry[];
  initialUserIds: string[];
}

// Matches getPointsProgressionAction's own cap -- keeps the chart/table
// legible and the picker from disabling every remaining option at once.
const MAX_PLAYERS = 8;

function displayName(p: { userName: string | null; username: string | null }): string {
  return p.username || p.userName || "Unknown";
}

export function PlayerCompareModal({ open, onClose, seasonType, roster, initialUserIds }: PlayerCompareModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialUserIds);
  const [progression, setProgression] = useState<UserPointsProgression[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-seed the selection each time the modal is opened for a (possibly
  // different) clicked player, rather than carrying over the last session.
  useEffect(() => {
    if (open) setSelectedIds(initialUserIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialUserIds.join(",")]);

  useEffect(() => {
    if (!open || selectedIds.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await getPointsProgressionAction(seasonType, selectedIds);
      if (result.success) {
        setProgression(result.data);
      } else {
        setError(result.error);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seasonType, selectedIds.join(",")]);

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(userId)) {
        // Always leave at least one player selected -- an empty chart isn't useful.
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== userId);
      }
      if (prev.length >= MAX_PLAYERS) return prev;
      return [...prev, userId];
    });
  };

  const colorByUserId = new Map(selectedIds.map((id, i) => [id, COLORS[i % COLORS.length]]));
  const allWeekNumbers = Array.from(new Set(progression.flatMap((p) => p.weeks.map((w) => w.weekNumber)))).sort(
    (a, b) => a - b
  );
  const chartData = allWeekNumbers.map((wk) => {
    const row: { week: string; [key: string]: string | number } = { week: `W${wk}` };
    for (const p of progression) {
      row[displayName(p)] = p.weeks.find((w) => w.weekNumber === wk)?.cumulativePoints ?? 0;
    }
    return row;
  });

  return (
    <Modal open={open} onClose={onClose} boxClassName="max-w-4xl">
      <ModalTitle>Compare Points</ModalTitle>

      <div className="mt-4">
        {selectedIds.length < MAX_PLAYERS && (
          <select
            // daisyUI's default select focus ring reads as a bright white
            // outline against this dark theme once the control has been
            // interacted with -- softened to a dim outline instead of
            // dropping focus styling altogether (still visible for
            // keyboard/accessibility use, just not glaring).
            className="select select-sm select-ghost w-auto pl-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-base-content/20"
            value=""
            onChange={(e) => {
              if (e.target.value) toggleUser(e.target.value);
            }}
            aria-label="Add a player to compare"
          >
            <option value="">+ Add player</option>
            {roster
              .filter((r) => !selectedIds.includes(r.userId))
              .map((r) => (
                <option key={r.userId} value={r.userId}>
                  {displayName(r)}
                </option>
              ))}
          </select>
        )}
      </div>
      {selectedIds.length >= MAX_PLAYERS && (
        <p className="text-xs text-base-content/50 mt-1.5">Up to {MAX_PLAYERS} players at a time.</p>
      )}

      {error && <p className="text-error text-sm mt-4">{error}</p>}

      {!error && isPending && progression.length === 0 && (
        <div className="flex items-center justify-center h-64 text-base-content/50">Loading...</div>
      )}

      {!error && allWeekNumbers.length === 0 && !isPending && (
        <p className="text-base-content/60 text-center py-12">No graded weeks yet.</p>
      )}

      {allWeekNumbers.length > 0 && (
        <>
          <div className="mt-4">
            <WeeklyPerformanceChart data={chartData} players={progression.map(displayName)} />
          </div>

          <div className="mt-6 space-y-4">
            {progression.map((p) => (
              <div key={p.userId} className="border border-base-300 rounded-lg overflow-hidden">
                <div
                  className="px-3 py-1.5 text-sm font-semibold border-l-4 flex items-center justify-between"
                  style={{ borderLeftColor: colorByUserId.get(p.userId) }}
                >
                  {displayName(p)}
                  {selectedIds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleUser(p.userId)}
                      className="text-base-content/50 hover:text-base-content"
                      aria-label={`Remove ${displayName(p)}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="table table-xs">
                    <thead>
                      <tr className="bg-base-200">
                        <th>Week</th>
                        <th className="text-center">Correct</th>
                        <th className="text-center">+1st</th>
                        <th className="text-center">+2nd</th>
                        <th className="text-center">+TB</th>
                        <th className="text-center">Wk Total</th>
                        <th className="text-center font-semibold">Running Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.weeks.map((w) => (
                        <tr key={w.weekNumber}>
                          <td className="font-medium">{w.weekNumber}</td>
                          <td className="text-center">{w.correctPicks}</td>
                          <td className="text-center">{w.firstBonus || ""}</td>
                          <td className="text-center">{w.secondBonus || ""}</td>
                          <td className="text-center">{w.tiebreakerBonus || ""}</td>
                          <td className="text-center">{w.weekPoints}</td>
                          <td className="text-center font-semibold">{w.cumulativePoints}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ModalActions>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </ModalActions>
    </Modal>
  );
}
