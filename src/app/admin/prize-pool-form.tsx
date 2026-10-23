"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui";
import { updatePrizePoolSettingsAction } from "./actions";
import type { PrizePoolSettings } from "@/lib/data";

interface PrizePoolFormProps {
  initial: PrizePoolSettings;
}

export function PrizePoolForm({ initial }: PrizePoolFormProps) {
  const [buyIn, setBuyIn] = useState(String(initial.buyInDollars));
  const [enabled, setEnabled] = useState(initial.enabled);
  const [first, setFirst] = useState(String(initial.split.first));
  const [second, setSecond] = useState(String(initial.split.second));
  const [third, setThird] = useState(String(initial.split.third));
  const [isPending, startTransition] = useTransition();

  const percentTotal = (Number(first) || 0) + (Number(second) || 0) + (Number(third) || 0);

  const handleSave = () => {
    const parsedBuyIn = Number(buyIn);
    const parsedFirst = Number(first);
    const parsedSecond = Number(second);
    const parsedThird = Number(third);

    if (!Number.isInteger(parsedBuyIn) || parsedBuyIn < 1) {
      toast.error("Enter a whole dollar buy-in amount of at least $1");
      return;
    }
    if (![parsedFirst, parsedSecond, parsedThird].every((p) => Number.isInteger(p) && p >= 0 && p <= 100)) {
      toast.error("Each place's percentage must be a whole number between 0 and 100");
      return;
    }
    if (percentTotal !== 100) {
      toast.error("1st + 2nd + 3rd must add up to 100%");
      return;
    }

    startTransition(async () => {
      const result = await updatePrizePoolSettingsAction(
        parsedBuyIn,
        enabled,
        parsedFirst,
        parsedSecond,
        parsedThird
      );
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Prize pool updated");
      }
    });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 cursor-pointer w-fit">
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-sm"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={isPending}
        />
        <span className="text-sm font-medium">Show prize pot banner to everyone</span>
      </label>

      <label className="form-control w-32">
        <span className="label-text text-sm mb-1">Buy-in (USD)</span>
        <div className="join">
          <span className="join-item btn btn-sm btn-disabled px-3">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            className="join-item input input-sm input-bordered w-full"
            value={buyIn}
            onChange={(e) => setBuyIn(e.target.value)}
            disabled={isPending}
          />
        </div>
      </label>

      <div className="flex flex-wrap items-end gap-3">
        {[
          { label: "1st place %", value: first, set: setFirst },
          { label: "2nd place %", value: second, set: setSecond },
          { label: "3rd place %", value: third, set: setThird },
        ].map(({ label, value, set }) => (
          <label key={label} className="form-control w-28">
            <span className="label-text text-sm mb-1">{label}</span>
            <div className="join">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                className="join-item input input-sm input-bordered w-full"
                value={value}
                onChange={(e) => set(e.target.value)}
                disabled={isPending}
              />
              <span className="join-item btn btn-sm btn-disabled px-3">%</span>
            </div>
          </label>
        ))}
        <span className={`text-sm pb-2 ${percentTotal === 100 ? "text-base-content/50" : "text-error"}`}>
          {percentTotal}% total
        </span>
      </div>

      <Button onClick={handleSave} disabled={isPending} loading={isPending} size="sm">
        Save
      </Button>
    </div>
  );
}
