import { Trophy } from "lucide-react";
import type { PrizePot } from "@/lib/prize-pool";

function formatDollars(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * The season's current prize pot (src/lib/prize-pool.ts -- admin-editable
 * buy-in and split), shown app-wide right under the nav and above the
 * admin's home message. Server-rendered from the live paid-player count
 * rather than a static number, so it updates on its own as players pay
 * their buy-in (or get deactivated) with no admin step beyond what already
 * drives getPaidPlayerCount. Hidden entirely until at least one player has
 * paid -- a "$0 / $0 / $0" row before anyone's bought in would just read as
 * broken.
 */
export function PrizePotBanner({ paidPlayers, pot, first, second, third }: PrizePot) {
  if (paidPlayers === 0) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/30">
      <div className="max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-base-content/80">
          <Trophy className="w-4 h-4 text-primary" />
          {formatDollars(pot)} pot
        </span>
        <span className="text-base-content/70">
          <span className="font-medium text-base-content">1st</span> {formatDollars(first)}
        </span>
        <span className="text-base-content/70">
          <span className="font-medium text-base-content">2nd</span> {formatDollars(second)}
        </span>
        <span className="text-base-content/70">
          <span className="font-medium text-base-content">3rd</span> {formatDollars(third)}
        </span>
      </div>
    </div>
  );
}
