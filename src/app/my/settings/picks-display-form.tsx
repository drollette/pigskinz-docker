"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { updatePicksDisplayAction } from "./actions";

interface PicksDisplayPrefs {
  showStats: boolean;
  showOdds: boolean;
}

interface PicksDisplayFormProps {
  initial: PicksDisplayPrefs;
}

const rows: { key: keyof PicksDisplayPrefs; label: string; description: string }[] = [
  {
    key: "showStats",
    label: "Team records & streaks",
    description: 'Each team\'s season record and current streak, e.g. "(6-7-0/W3)".',
  },
  {
    key: "showOdds",
    label: "Betting odds",
    description: "The favorite's point spread and the game's over/under.",
  },
];

export function PicksDisplayForm({ initial }: PicksDisplayFormProps) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, setPending] = useState(false);

  const save = (next: PicksDisplayPrefs) => {
    const previous = prefs;
    setPrefs(next);
    setPending(true);
    updatePicksDisplayAction(next.showStats, next.showOdds)
      .then((result) => {
        if ("error" in result) {
          toast.error(result.error);
          setPrefs(previous);
        } else {
          toast.success("Picks display saved");
        }
      })
      .finally(() => setPending(false));
  };

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <label key={row.key} className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <div className="font-medium">{row.label}</div>
            <div className="text-sm text-base-content/60">{row.description}</div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-primary shrink-0"
            checked={prefs[row.key]}
            onChange={(e) => save({ ...prefs, [row.key]: e.target.checked })}
            disabled={pending}
          />
        </label>
      ))}
    </div>
  );
}
