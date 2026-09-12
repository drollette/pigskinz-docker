"use client";

import type { SidePanelType } from "@/db/schema";
import { SIDE_PANEL_LABELS } from "@/lib/side-panels";
import { blackOpsOne } from "@/lib/fonts";

interface PanelSelectProps {
  options: SidePanelType[];
  active: SidePanelType;
  interactive: boolean;
  onChange: (type: SidePanelType) => void;
}

/** The header atop a column, styled exactly like each view's own page-title
 * heading (the blackOpsOne stencil font + uppercase every `h1` already gets
 * globally, reproduced here by hand since a `<select>` isn't one) -- but
 * it's the dropdown itself, not a separate control sitting above one. Every
 * view's own internal heading is `lg:hidden`, since this replaces it at the
 * widths where this renders (ContentShell's two side columns, ColumnPage's
 * three equal ones -- both lg+ only); below that, the view's own heading is
 * what's shown instead, since there's no picker on a phone to be one.
 * `select-ghost` keeps it looking like plain heading text until it's
 * actually focused/opened. Disabled rather than omitted when not
 * `interactive` (a signed-out visitor), so a header still shows there too
 * -- just inert, since there's nothing to persist a pick to. */
export function PanelSelect({ options, active, interactive, onChange }: PanelSelectProps) {
  return (
    <select
      className={`${blackOpsOne.className} select select-ghost w-full px-0 text-2xl uppercase tracking-wide text-base-content disabled:text-base-content disabled:opacity-100`}
      value={active}
      disabled={!interactive}
      onChange={(e) => onChange(e.target.value as SidePanelType)}
    >
      {options.map((type) => (
        <option key={type} value={type} className={`${blackOpsOne.className} bg-base-100 text-base-content`}>
          {SIDE_PANEL_LABELS[type]}
        </option>
      ))}
    </select>
  );
}
