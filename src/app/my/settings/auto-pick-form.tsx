"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { updateAutoPickAction } from "./actions";
import type { AutoPickStrategy } from "@/db/schema";

const strategyOptions: { value: AutoPickStrategy; label: string; description: string }[] = [
  { value: "random", label: "Random", description: "Coin flip between the two teams" },
  { value: "home", label: "Home team", description: "Always pick the home team" },
  { value: "away", label: "Away team", description: "Always pick the away team" },
  { value: "spread", label: "With the spread", description: "Pick whichever team is favored" },
  { value: "underdog", label: "Against the spread", description: "Pick whichever team is the underdog" },
];

interface AutoPickFormProps {
  initialEnabled: boolean;
  initialStrategy: AutoPickStrategy;
}

export function AutoPickForm({ initialEnabled, initialStrategy }: AutoPickFormProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [strategy, setStrategy] = useState<AutoPickStrategy>(initialStrategy);
  const [isPending, startTransition] = useTransition();

  const save = (newEnabled: boolean, newStrategy: AutoPickStrategy) => {
    startTransition(async () => {
      const result = await updateAutoPickAction(newEnabled, newStrategy);
      if ("error" in result) {
        toast.error(result.error);
        setEnabled(enabled);
        setStrategy(strategy);
      } else {
        toast.success("Auto-pick preference saved");
      }
    });
  };

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    save(checked, strategy);
  };

  const handleStrategyChange = (value: AutoPickStrategy) => {
    setStrategy(value);
    if (enabled) save(enabled, value);
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <div>
          <div className="font-medium">Auto-pick for missed games</div>
          <div className="text-sm text-base-content/60">
            If you haven&apos;t picked a game by the time it&apos;s about to start, we&apos;ll
            make a pick for you and email you what we picked.
          </div>
        </div>
        <input
          type="checkbox"
          className="toggle toggle-primary shrink-0"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={isPending}
        />
      </label>

      {enabled && (
        <div className="grid gap-3">
          {strategyOptions.map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-4 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                strategy === option.value
                  ? "border-primary bg-primary/5"
                  : "border-base-300 hover:border-base-content/30"
              }`}
            >
              <input
                type="radio"
                name="autoPickStrategy"
                value={option.value}
                checked={strategy === option.value}
                onChange={() => handleStrategyChange(option.value)}
                className="radio radio-primary"
                disabled={isPending}
              />
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-sm text-base-content/60">{option.description}</div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
