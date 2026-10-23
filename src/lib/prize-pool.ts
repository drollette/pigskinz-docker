// Prize pot math shared by the banner (prize-pot-banner.tsx), the Rules
// page, and the welcome email -- all of which used to each hardcode their
// own copy of the buy-in and split. Both are admin-editable
// (site_settings.buyInDollars/prize*Percent, see getPrizePoolSettings and
// getBuyInDollars in data.ts); this module only owns the fallback defaults
// for an unconfigured environment and the pot/payout arithmetic.
export const DEFAULT_BUY_IN_DOLLARS = 20;

// Whole percentages, not fractions -- matches how the admin form and DB
// columns store them (prize_first_percent etc.), so no 0-1 vs 0-100
// conversion has to happen at every boundary.
export const DEFAULT_PRIZE_SPLIT: PrizeSplit = {
  first: 60,
  second: 30,
  third: 10,
};

export interface PrizeSplit {
  first: number;
  second: number;
  third: number;
}

export interface PrizePot {
  paidPlayers: number;
  buyInDollars: number;
  split: PrizeSplit;
  pot: number;
  first: number;
  second: number;
  third: number;
}

// Whole-dollar buy-ins times a whole-percent split don't always divide into
// whole dollars (e.g. a 7-player pot at $20 split 60/30/10 is $140 * 0.3 =
// $42, fine, but an uneven split or player count can land on a fraction of
// a cent) -- Math.round keeps every displayed amount a whole dollar
// regardless.
export function calculatePrizePot(paidPlayers: number, buyInDollars: number, split: PrizeSplit): PrizePot {
  const pot = paidPlayers * buyInDollars;
  return {
    paidPlayers,
    buyInDollars,
    split,
    pot,
    first: Math.round((pot * split.first) / 100),
    second: Math.round((pot * split.second) / 100),
    third: Math.round((pot * split.third) / 100),
  };
}
