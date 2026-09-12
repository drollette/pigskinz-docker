import type { ReactNode } from "react";

/** A column fixed to exactly the space below the navbar (100dvh minus its
 * ~5rem height and the 1rem of padding main adds above content) rather
 * than left to grow with its content: `header` stays put at the top while
 * `children` scrolls independently in the remaining space (`min-h-0` is
 * what lets a flex child actually shrink enough to become scrollable
 * instead of just growing to fit its content). Both consumers (ContentShell's
 * side columns, ColumnPage's three equal ones) only ever mount this at lg+,
 * so the height cap doesn't need its own breakpoint guard here.
 *
 * `overscroll-contain` is what actually stops a column's own scroll from
 * spilling into the page once it hits that column's top/bottom edge --
 * without it, clamping height alone isn't enough to prevent the "whole
 * page jumps" feel once a column runs out of room to keep scrolling. */
export function ScrollableColumn({ header, children }: { header?: ReactNode; children: ReactNode }) {
  return (
    <div className="@container flex flex-col min-w-0 h-[calc(100dvh-6rem)]">
      {header}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain space-y-2 mt-2">
        {children}
      </div>
    </div>
  );
}
