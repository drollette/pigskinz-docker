import { eq, inArray } from "drizzle-orm";
import { users } from "@/db/schema";
import type { Database } from "@/db";
import type { AppEnv } from "./env";
import { sendAdminBroadcastEmail } from "./email";
import { getMergeVariablesForUsers, applyMergeVariables } from "./email-merge-vars";

export type BroadcastRecipientMode = "all" | "unpaid" | "selected";

export interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
}

/**
 * Sends an admin-authored email to either every registered user or a
 * specific set of them (an "individual" is just a one-element selection).
 * Sends are sequential with a per-recipient try/catch, matching the pattern
 * used for pick-reminder and auto-pick emails, so one bad address doesn't
 * block the rest of the batch.
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
  }

  return { total: recipients.length, sent, failed };
}
