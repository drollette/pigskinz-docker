import { eq, inArray } from "drizzle-orm";
import { users } from "@/db/schema";
import type { Database } from "@/db";
import type { AppEnv } from "./env";
import { sendAdminBroadcastEmail } from "./email";
import { sendPushToUser } from "./push";
import { getMergeVariablesForUsers, applyMergeVariables } from "./email-merge-vars";

export type BroadcastRecipientMode = "all" | "unpaid" | "selected";

export interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
}

// The admin-authored body is sanitized HTML (see HOME_MESSAGE_ALLOWED_TAGS
// in admin/actions.ts), fine for an email but too much markup for a one-line
// push body -- strips tags down to plain text and truncates, same idea as
// truncateForNotification in locker-room/actions.ts.
function stripHtmlForPush(html: string, maxLength = 120): string {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/**
 * Sends an admin-authored email to either every registered user or a
 * specific set of them (an "individual" is just a one-element selection).
 * Sends are sequential with a per-recipient try/catch, matching the pattern
 * used for pick-reminder and auto-pick emails, so one bad address doesn't
 * block the rest of the batch.
 *
 * Also pushes the same message to every recipient's subscribed device(s),
 * unconditionally -- like the email above, an admin broadcast has no
 * per-user opt-out on either channel (it's a "reach everyone" tool by
 * design, not a routine digest). Push failures are logged but don't affect
 * BroadcastResult, which stays email-only to match what the admin dashboard
 * actually displays ("Sent to X of Y recipients").
 */
export async function sendAdminBroadcast(
  db: Database,
  env: AppEnv,
  {
    subject,
    bodyHtml,
    recipientMode,
    selectedUserIds,
  }: {
    subject: string;
    bodyHtml: string;
    recipientMode: BroadcastRecipientMode;
    selectedUserIds: string[];
  }
): Promise<BroadcastResult> {
  const recipients =
    recipientMode === "all"
      ? await db.select({ id: users.id, email: users.email, name: users.name }).from(users)
      : recipientMode === "unpaid"
        ? await db
            .select({ id: users.id, email: users.email, name: users.name })
            .from(users)
            .where(eq(users.hasPaid, false))
        : selectedUserIds.length === 0
          ? []
          : await db
              .select({ id: users.id, email: users.email, name: users.name })
              .from(users)
              .where(inArray(users.id, selectedUserIds));

  // Only bother resolving {variable} values (next game, standings) when the
  // message actually references one -- most broadcasts won't.
  const hasMergeVariables = /\{\w+\}/.test(subject) || /\{\w+\}/.test(bodyHtml);
  const mergeVarsByUser = hasMergeVariables
    ? await getMergeVariablesForUsers(db, recipients.map((r) => r.id))
    : null;

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const vars = mergeVarsByUser?.get(recipient.id);
      const recipientSubject = vars ? applyMergeVariables(subject, vars) : subject;
      const recipientBody = vars ? applyMergeVariables(bodyHtml, vars) : bodyHtml;
      await sendAdminBroadcastEmail(recipient.email, recipient.name, recipientSubject, recipientBody, env);
      sent++;
    } catch (error) {
      console.error(`Failed to send admin broadcast to ${recipient.email}:`, error);
      failed++;
    }

    try {
      const vars = mergeVarsByUser?.get(recipient.id);
      const recipientBody = vars ? applyMergeVariables(bodyHtml, vars) : bodyHtml;
      await sendPushToUser(db, env, recipient.id, {
        title: vars ? applyMergeVariables(subject, vars) : subject,
        body: stripHtmlForPush(recipientBody),
        url: "/",
      });
    } catch (error) {
      console.error(`Failed to send admin broadcast push to ${recipient.id}:`, error);
    }
  }

  return { total: recipients.length, sent, failed };
}
