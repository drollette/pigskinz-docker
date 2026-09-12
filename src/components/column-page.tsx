"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { SidePanelType } from "@/db/schema";
import { ALL_SIDE_PANEL_TYPES, resolveColumns, type ColumnTriple, type ColumnPin } from "@/lib/side-panels";
import { updateColumnsAction } from "@/app/actions";
import { ScrollableColumn } from "@/components/scrollable-column";
import { PanelSelect } from "@/components/panel-select";

interface ColumnPageProps {
  /** This page's column arrangement before the user has customized it. */
  defaults: ColumnTriple;
  /** This route's own deep-link intent, e.g. /schedule/2/5 pins "schedule"
   * into whichever column already holds it (or its fallback slot). Omit
   * for a page with no specific view to force -- ColumnPage will only ever
   * be reached today via a route that has one, but this keeps the type
   * honest rather than assuming a pin always exists. */
  pin?: ColumnPin;
  /** True once there's a signed-in user to persist a choice for. */
  signedIn: boolean;
  /** The signed-in user's saved column arrangement, if they've ever set one. */
  saved?: SidePanelType[];
  /** Pre-rendered content for every one of the three views. */
  panels: Partial<Record<SidePanelType, ReactNode>>;
}

/**
 * Three fully equal, independently scrollable columns, each with its own
 * dropdown header letting the user pick what it shows -- the generalized
 * successor to ContentShell's main+2-side split, for pages that no longer
 * have a single privileged "main content." lg+ only: on a phone there's no
 * room for three of anything, so only the column holding this route's own
 * pinned view renders, full width, with no picker (the nav menu is still
 * how a phone browses between views).
 */
export function ColumnPage({ defaults, pin, signedIn, saved, panels }: ColumnPageProps) {
  const initial = resolveColumns(saved, pin, defaults);
  const [columns, setColumns] = useState<ColumnTriple>(initial);
  const [, startTransition] = useTransition();

  const primaryIndex = pin ? Math.max(columns.indexOf(pin.type), 0) : 0;

  function choose(slot: 0 | 1 | 2, type: SidePanelType) {
    // Picking a type already shown in another column swaps the two,
    // rather than leaving that column empty or duplicating a view.
    const otherSlot = columns.indexOf(type);
    const next: ColumnTriple = [...columns];
    next[slot] = type;
    if (otherSlot !== -1 && otherSlot !== slot) {
      next[otherSlot] = columns[slot];
    }
    setColumns(next);
    if (signedIn) {
      startTransition(async () => {
        await updateColumnsAction(next);
      });
    }
  }

  return (
    <>
      {/* Phone: just this route's own view, full width -- browsing to a
          different one happens through the nav menu, not a picker. */}
      <div className="lg:hidden">{panels[columns[primaryIndex]]}</div>

      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4 xl:gap-6 lg:items-start">
        {columns.map((type, index) => (
          <ScrollableColumn
            key={index}
            header={
              <PanelSelect
                options={ALL_SIDE_PANEL_TYPES}
                active={type}
                interactive={signedIn}
                onChange={(t) => choose(index as 0 | 1 | 2, t)}
              />
            }
          >
            {panels[type]}
          </ScrollableColumn>
        ))}
      </div>
    </>
  );
}
