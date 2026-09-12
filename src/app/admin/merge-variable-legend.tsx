"use client";

import { MERGE_VARIABLE_NAMES } from "@/lib/email-merge-var-names";

/**
 * Reference list of {variable} tokens admins can drop into a subject/body --
 * shown in both the composer (AdminEmailForm) and the template editor
 * (EmailTemplateManager) so it's visible wherever a message is written.
 * Values are resolved per-recipient at send time (see email-merge-vars.ts);
 * unrecognized tokens are left as literal text rather than blanked out.
 */
export function MergeVariableLegend() {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-base-content/60 hover:text-base-content">
        Available variables
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MERGE_VARIABLE_NAMES.map((name) => (
          <code key={name} className="px-1.5 py-0.5 rounded bg-base-200 text-xs">
            {`{${name}}`}
          </code>
        ))}
      </div>
    </details>
  );
}
