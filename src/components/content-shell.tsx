"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { SidePanelType } from "@/db/schema";
import { ALL_SIDE_PANEL_TYPES, resolveSidePanels } from "@/lib/side-panels";
import { updateSidePanelsAction } from "@/app/actions";
import { ScrollableColumn } from "@/components/scrollable-column";
import { PanelSelect } from "@/components/panel-select";

interface ContentShellProps {
  /** The type of the three interchangeable side panels (standings/locker
   * room/picks) that this page's own main content already is, if any --
   * excluded from both slots so a page never offers to show its own
   * content a second time in the margin. */
  excluded: SidePanelType | null;
  /** This page's panel pair before the user has customized it, or once
   * their saved choice no longer fits here (e.g. it pointed at `excluded`). */
  defaultLeft: SidePanelType;
  defaultRight: SidePanelType;
  /** True once there's a signed-in user to persist a choice for -- the
   * picker is otherwise inert (both slots just show the default pair, and
   * clicking does nothing) since there's nothing to remember for a
   * signed-out visitor. */
  signedIn: boolean;
  /** The signed-in user's saved choice, if they've ever set one. */
  saved?: { left?: SidePanelType; right?: SidePanelType };
  /** Pre-rendered content for every side-panel type this page allows (all
   * three minus `excluded`) -- swapping which type occupies which slot is
   * then just a state change on the client, never a refetch. */
  panels: Partial<Record<SidePanelType, ReactNode>>;
  children: ReactNode;
}

/** Adds this page's side panels once the viewport is wide enough for them
 * not to crowd out the main content -- lg+ only, i.e. never on a phone. All
 * three columns are equal width (a plain 3-up grid, growing together as the
 * viewport widens). Both side columns are always populated: between the
 * three panel types, at most one is ever excluded on a given page, so
 * there are always at least two left for the two slots.
 *
 * All three columns, including the main one, are capped to exactly the
 * space below the navbar and scroll independently within that (see
 * ScrollableColumn) -- nothing here ever grows the page itself past the
 * viewport, which is what keeps scrolling one column from also nudging
 * the whole page. */
export function ContentShell({
  excluded,
  defaultLeft,
  defaultRight,
  signedIn,
  saved,
  panels,
  children,
}: ContentShellProps) {
  const defaults = { left: defaultLeft, right: defaultRight };
  const initial = resolveSidePanels(saved, excluded, defaults);
  const [left, setLeft] = useState<SidePanelType>(initial.left);
  const [right, setRight] = useState<SidePanelType>(initial.right);
  const [, startTransition] = useTransition();

  const available = ALL_SIDE_PANEL_TYPES.filter((t) => t !== excluded);

  function choose(slot: "left" | "right", type: SidePanelType) {
    // Picking a type already shown in the other slot swaps the two,
    // rather than leaving that slot empty or showing the same panel twice.
    const nextLeft = slot === "left" ? type : type === left ? right : left;
    const nextRight = slot === "right" ? type : type === right ? left : right;
    setLeft(nextLeft);
    setRight(nextRight);
    if (signedIn) {
      startTransition(async () => {
        await updateSidePanelsAction(nextLeft, nextRight);
      });
    }
  }

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-4 xl:gap-6 lg:items-start">
      <SideColumn
        picker={
          <PanelSelect
            options={available}
            active={left}
            interactive={signedIn}
            onChange={(t) => choose("left", t)}
          />
        }
      >
        {panels[left]}
      </SideColumn>
      <div className="min-w-0 lg:h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-contain">
        {children}
      </div>
      <SideColumn
        picker={
          <PanelSelect
            options={available}
            active={right}
            interactive={signedIn}
            onChange={(t) => choose("right", t)}
          />
        }
      >
        {panels[right]}
      </SideColumn>
    </div>
  );
}

function SideColumn({ picker, children }: { picker?: ReactNode; children: ReactNode }) {
  return (
    <div className="hidden lg:block">
      <ScrollableColumn header={picker}>{children}</ScrollableColumn>
    </div>
  );
}
