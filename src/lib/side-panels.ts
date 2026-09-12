import type { SidePanelType } from "@/db/schema";

export const ALL_SIDE_PANEL_TYPES: SidePanelType[] = [
  "poolStandings",
  "lockerRoom",
  "picks",
  "schedule",
  "nflStandings",
  "rules",
];

// Kept short (rather than e.g. "Locker Room") since these label the compact
// picker buttons in a side column as narrow as 220px, sometimes fitting
// three (or, in ColumnPage, six) across -- the panel's own header still
// spells out the full name.
export const SIDE_PANEL_LABELS: Record<SidePanelType, string> = {
  poolStandings: "Pool Standings",
  lockerRoom: "Chat",
  picks: "Picks",
  schedule: "Schedule",
  nflStandings: "NFL Standings",
  rules: "Rules",
};

export interface SidePanelSelection {
  left: SidePanelType;
  right: SidePanelType;
}

/**
 * Which panel type occupies each of ContentShell's two side columns: the
 * user's saved choice for that slot when it's still valid on this page
 * (not the type this page's own content already is, and not a duplicate
 * of whatever the other slot resolved to), otherwise this page's default
 * pair. Pure function so both the server (initial render) and the client
 * (after a pick) compute the same thing the same way.
 */
export function resolveSidePanels(
  saved: { left?: SidePanelType; right?: SidePanelType } | undefined,
  excluded: SidePanelType | null,
  defaults: SidePanelSelection
): SidePanelSelection {
  const isValid = (t: SidePanelType | undefined): t is SidePanelType => !!t && t !== excluded;

  const left = isValid(saved?.left) ? saved.left : defaults.left;
  const right = isValid(saved?.right) ? saved.right : defaults.right;

  // A collision (both slots landed on the same type -- e.g. only "left" was
  // ever saved and it happens to match this page's default "right") is
  // ambiguous enough that falling back to the page's own default pair is
  // safer than guessing which slot should give way.
  if (left === right) return defaults;
  return { left, right };
}

export type ColumnTriple = [SidePanelType, SidePanelType, SidePanelType];

/** A route's own deep-link intent for ColumnPage -- e.g. visiting
 * /schedule/2/5 means "one column must show Schedule, pre-seeded to that
 * week" regardless of what's saved. */
export interface ColumnPin {
  slot: 0 | 1 | 2;
  type: SidePanelType;
}

/**
 * Which view occupies each of ColumnPage's three fully equal columns: the
 * user's saved arrangement when it's a genuine 3-way split (no repeats),
 * otherwise this page's defaults. A pin then forces its type into whichever
 * column already holds it (preserving a customized arrangement) or, if it
 * isn't present anywhere, into its fallback slot -- never creating a
 * duplicate, since a slot is only ever overwritten when its new value
 * wasn't already sitting in one of the other two.
 */
export function resolveColumns(
  saved: SidePanelType[] | undefined,
  pin: ColumnPin | undefined,
  defaults: ColumnTriple
): ColumnTriple {
  const base: ColumnTriple =
    saved && saved.length === 3 && new Set(saved).size === 3
      ? [saved[0], saved[1], saved[2]]
      : defaults;

  if (!pin) return base;

  const existingSlot = base.indexOf(pin.type);
  const targetSlot = existingSlot !== -1 ? existingSlot : pin.slot;

  const result: ColumnTriple = [...base];
  result[targetSlot] = pin.type;
  return result;
}
