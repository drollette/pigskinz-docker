"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { formatGameDate, formatGameTime } from "@/lib/utils";
import { submitTiebreakerAction } from "@/app/picks/[seasonType]/[weekNum]/actions";
import { Avatar } from "@/components/ui/avatar";
import type { GameData, getAllTiebreakerPredictions } from "@/lib/data";

interface TiebreakerCardProps {
  game: GameData;
  weekNumber: number;
  seasonType: number;
  currentUserId: string;
  currentPrediction: number | null;
  takenValues: number[];
  disabled?: boolean;
  /** Every user's submitted prediction — only rendered once `revealed`. */
  allPredictions: Awaited<ReturnType<typeof getAllTiebreakerPredictions>>;
  /** Whether other players' predictions can be shown (tiebreaker game has started) */
  revealed: boolean;
}

export function TiebreakerCard({
  game,
  weekNumber,
  seasonType,
  currentUserId,
  currentPrediction,
  takenValues,
  disabled = false,
  allPredictions,
  revealed,
}: TiebreakerCardProps) {
  const [isPending, startTransition] = useTransition();
  const [prediction, setPrediction] = useState<string>(
    currentPrediction?.toString() ?? ""
  );
  const [savedValue, setSavedValue] = useState<number | null>(currentPrediction);

  const gameDate = new Date(game.date);
  const hasStarted = new Date() >= gameDate;
  const isLocked = disabled || hasStarted || game.completed;

  const handleSubmit = () => {
    const value = parseInt(prediction);
    if (isNaN(value) || value < 0 || value > 200) {
      toast.error("Enter a valid number between 0 and 200");
      return;
    }

    // Check if value is taken (but not by current user)
    if (takenValues.includes(value) && value !== savedValue) {
      toast.error(`${value} points has already been selected`);
      return;
    }

    startTransition(async () => {
      try {
        await submitTiebreakerAction({
          weekNumber,
          seasonType,
          prediction: value,
        });
        setSavedValue(value);
        toast.success("Tiebreaker saved!");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save tiebreaker"
        );
      }
    });
  };

  // Calculate actual total if game is completed
  const actualTotal =
    game.completed && game.homeTeam.score !== null && game.awayTeam.score !== null
      ? game.homeTeam.score + game.awayTeam.score
      : null;

  // Calculate difference if we have both prediction and actual
  const difference =
    savedValue !== null && actualTotal !== null
      ? Math.abs(savedValue - actualTotal)
      : null;

  return (
    <div className="card w-full m-3 p-4 max-w-3xl bg-base-100 border-2 border-secondary/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="badge badge-secondary">Tiebreaker</span>
        <span className="text-sm text-base-content/60">Last game of the week</span>
      </div>

      <h2 className="card-title text-base sm:text-lg font-semibold text-base-content">
        {game.shortName}
      </h2>

      <div className="flex justify-between text-xs sm:text-sm text-base-content/60 mt-1">
        <span>{formatGameDate(gameDate)}</span>
        <span>{formatGameTime(gameDate)}</span>
      </div>

      <div className="mt-4">
        <label className="text-sm text-base-content/70 mb-2 block">
          Predict the total combined points:
        </label>

        <div className="flex gap-2 items-center">
          <input
            type="number"
            min="0"
            max="200"
            value={prediction}
            onChange={(e) => setPrediction(e.target.value)}
            disabled={isLocked || isPending}
            placeholder="e.g., 42"
            className={cn(
              "input w-24",
              isLocked && "input-disabled opacity-60"
            )}
          />

          <button
            onClick={handleSubmit}
            disabled={isLocked || isPending || prediction === ""}
            className={cn(
              "btn btn-secondary btn-sm",
              isPending && "loading"
            )}
          >
            {isPending ? "Saving..." : savedValue !== null ? "Update" : "Save"}
          </button>

          {savedValue !== null && !isPending && (
            <span className="text-sm text-success">
              Saved: {savedValue} pts
            </span>
          )}
        </div>

        {isLocked && !game.completed && (
          <p className="text-xs text-warning mt-2">
            Tiebreaker is locked - game has started
          </p>
        )}

        {game.completed && actualTotal !== null && (
          <div className="mt-3 p-3 bg-base-200 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm">Final Total:</span>
              <span className="font-bold text-lg">{actualTotal} pts</span>
            </div>
            {savedValue !== null && (
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm">Your Prediction:</span>
                <span className="font-semibold">{savedValue} pts</span>
              </div>
            )}
            {difference !== null && (
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm">Difference:</span>
                <span
                  className={cn(
                    "font-semibold",
                    difference === 0 ? "text-success" : "text-base-content"
                  )}
                >
                  {difference === 0 ? "Perfect!" : `${difference} pts off`}
                </span>
              </div>
            )}
          </div>
        )}

        {takenValues.length > 0 && !isLocked && (
          <details className="mt-3">
            <summary className="text-xs text-base-content/50 cursor-pointer">
              Already taken: {takenValues.length} values
            </summary>
            <div className="text-xs text-base-content/40 mt-1 flex flex-wrap gap-1">
              {takenValues.sort((a, b) => a - b).map((v) => (
                <span key={v} className="badge badge-ghost badge-xs">
                  {v}
                </span>
              ))}
            </div>
          </details>
        )}

        {revealed && allPredictions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-base-300">
            <p className="text-sm font-medium text-base-content/70 mb-2">
              Everyone&apos;s Predictions
            </p>
            <div className="space-y-1.5">
              {allPredictions.map((p) => (
                <div key={p.userId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={p.name} avatar={p.avatar} seed={p.username ?? p.userId} size="xs" />
                    <span className="truncate">
                      {p.username || p.name}
                      {p.userId === currentUserId && (
                        <span className="text-base-content/50"> (You)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums font-medium">{p.prediction}</span>
                    {p.diff !== null && (
                      <span className="text-xs text-base-content/50 tabular-nums">
                        {p.diff === 0 ? "Perfect!" : `±${p.diff}`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
