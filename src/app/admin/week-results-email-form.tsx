"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Button, RichTextEditor } from "@/components/ui";
import { updateWeekResultsEmailTemplateAction } from "./actions";
import { MergeVariableLegend } from "./merge-variable-legend";

interface WeekResultsEmailFormProps {
  initialSubject: string;
  initialBody: string;
}

function hasVisibleText(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

/** Editable template the automated week-results email sends from once a
 * week's picks_summary.rank is finalized (see worker.ts's scheduled
 * handler and src/lib/week-results-email.ts) -- clearing either field
 * pauses the feature rather than mailing out something incomplete. */
export function WeekResultsEmailForm({ initialSubject, initialBody }: WeekResultsEmailFormProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateWeekResultsEmailTemplateAction(subject, body);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const configured = subject.trim().length > 0 && hasVisibleText(body);
      toast.success(configured ? "Week results email template saved" : "Week results email disabled (subject or body is empty)");
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-base-content/60">
        Sent automatically once a week&apos;s last game finishes. Leave the subject or body blank
        to pause it.
      </p>
      <div>
        <label className="label">Subject</label>
        <input
          type="text"
          className="input w-full"
          placeholder="{week_results_week} Results"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={isPending}
        />
      </div>
      <div>
        <label className="label">Message</label>
        <RichTextEditor
          value={body}
          onChange={setBody}
          disabled={isPending}
          placeholder="Write the week-results email..."
        />
        <MergeVariableLegend />
      </div>
      <Button onClick={handleSave} disabled={isPending} loading={isPending}>
        Save
      </Button>
    </div>
  );
}
