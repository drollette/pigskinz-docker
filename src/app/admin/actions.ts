"use server";

import sanitizeHtml from "sanitize-html";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, getEnv } from "@/lib/env";
import { runEspnSync, runSeasonRollover } from "@/lib/sync-runner";
import { siteSettings, emailTemplates } from "@/db/schema";
import { SITE_SETTINGS_ID } from "@/lib/data";
import { generateId } from "@/lib/utils";
import { sendAdminBroadcast, type BroadcastRecipientMode } from "@/lib/admin-broadcast";

type ActionResult = { success: true } | { error: string };

// The admin home-message editor is a contentEditable WYSIWYG (see
// RichTextEditor), which lets the admin paste in arbitrary clipboard HTML —
// this allowlist strips that down to the handful of tags the toolbar
// actually produces before it's ever stored or rendered back to users.
const HOME_MESSAGE_ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "br",
  "p",
];

export async function updateHomeMessageAction(message: string): Promise<ActionResult> {
  await requireAdmin();

  const sanitized = sanitizeHtml(message, {
    allowedTags: HOME_MESSAGE_ALLOWED_TAGS,
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  }).trim();

  // contentEditable leaves behind markup like "<p><br></p>" for an
  // otherwise-empty editor, so check for actual visible text before
  // deciding this counts as "cleared".
  const hasVisibleText = sanitized.replace(/<[^>]*>/g, "").trim().length > 0;
  const homeMessage = hasVisibleText ? sanitized : null;

  const db = getDb();

  try {
    await db
      .insert(siteSettings)
      .values({ id: SITE_SETTINGS_ID, homeMessage, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteSettings.id,
        set: { homeMessage, updatedAt: new Date() },
      });
    return { success: true };
  } catch (error) {
    console.error("Update home message error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update home message",
    };
  }
}

type SendAdminEmailResult = { success: true; sent: number; failed: number; total: number } | { error: string };

export async function sendAdminEmailAction(
  subject: string,
  bodyHtml: string,
  recipientMode: BroadcastRecipientMode,
  selectedUserIds: string[]
): Promise<SendAdminEmailResult> {
  await requireAdmin();

  const trimmedSubject = subject.trim();
  if (!trimmedSubject) {
    return { error: "Subject is required" };
  }

  const sanitizedBody = sanitizeHtml(bodyHtml, {
    allowedTags: HOME_MESSAGE_ALLOWED_TAGS,
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  }).trim();

  const hasVisibleText = sanitizedBody.replace(/<[^>]*>/g, "").trim().length > 0;
  if (!hasVisibleText) {
    return { error: "Email body cannot be empty" };
  }

  if (recipientMode === "selected" && selectedUserIds.length === 0) {
    return { error: "Select at least one recipient" };
  }

  const db = getDb();
  const env = getEnv();

  try {
    const result = await sendAdminBroadcast(db, env, {
      subject: trimmedSubject,
      bodyHtml: sanitizedBody,
      recipientMode,
      selectedUserIds,
    });
    return { success: true, ...result };
  } catch (error) {
    console.error("Send admin email error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

export async function triggerSyncNowAction(): Promise<ActionResult> {
  await requireAdmin();

  try {
    await runEspnSync(getDb());
    return { success: true };
  } catch (error) {
    console.error("Trigger sync error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to sync with ESPN",
    };
  }
}

export async function triggerResetSeasonAction(
  seasonYear: string,
  confirm: string
): Promise<ActionResult> {
  await requireAdmin();

  const env = getEnv();
  const environment = env.ENVIRONMENT_NAME;
  const expected = `ROLLOVER-${environment}`;

  if (confirm !== expected) {
    return { error: `Confirmation text did not match. Expected "${expected}".` };
  }

  if (seasonYear !== "" && !/^\d{4}$/.test(seasonYear)) {
    return { error: "Season year must be a 4-digit year, or blank to auto-detect." };
  }

  const year = seasonYear !== "" ? parseInt(seasonYear, 10) : new Date().getUTCFullYear();

  try {
    await runSeasonRollover(getDb(), year);
    return { success: true };
  } catch (error) {
    console.error("Trigger reset season error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to roll over season",
    };
  }
}

type EmailTemplateResult =
  | { success: true; id: string }
  | { error: string };

function sanitizeEmailTemplateBody(bodyHtml: string): string {
  return sanitizeHtml(bodyHtml, {
    allowedTags: HOME_MESSAGE_ALLOWED_TAGS,
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  }).trim();
}

export async function createEmailTemplateAction(
  name: string,
  subject: string,
  bodyHtml: string
): Promise<EmailTemplateResult> {
  await requireAdmin();

  const trimmedName = name.trim();
  const trimmedSubject = subject.trim();
  if (!trimmedName) return { error: "Template name is required" };
  if (!trimmedSubject) return { error: "Subject is required" };

  const sanitizedBody = sanitizeEmailTemplateBody(bodyHtml);
  const hasVisibleText = sanitizedBody.replace(/<[^>]*>/g, "").trim().length > 0;
  if (!hasVisibleText) return { error: "Email body cannot be empty" };

  const db = getDb();
  const id = generateId();

  try {
    await db.insert(emailTemplates).values({
      id,
      name: trimmedName,
      subject: trimmedSubject,
      bodyHtml: sanitizedBody,
    });
    return { success: true, id };
  } catch (error) {
    console.error("Create email template error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to create template",
    };
  }
}

export async function updateEmailTemplateAction(
  id: string,
  name: string,
  subject: string,
  bodyHtml: string
): Promise<EmailTemplateResult> {
  await requireAdmin();

  const trimmedName = name.trim();
  const trimmedSubject = subject.trim();
  if (!trimmedName) return { error: "Template name is required" };
  if (!trimmedSubject) return { error: "Subject is required" };

  const sanitizedBody = sanitizeEmailTemplateBody(bodyHtml);
  const hasVisibleText = sanitizedBody.replace(/<[^>]*>/g, "").trim().length > 0;
  if (!hasVisibleText) return { error: "Email body cannot be empty" };

  const db = getDb();

  try {
    await db
      .update(emailTemplates)
      .set({
        name: trimmedName,
        subject: trimmedSubject,
        bodyHtml: sanitizedBody,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, id));
    return { success: true, id };
  } catch (error) {
    console.error("Update email template error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update template",
    };
  }
}

export async function deleteEmailTemplateAction(id: string): Promise<ActionResult> {
  await requireAdmin();

  const db = getDb();

  try {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
    return { success: true };
  } catch (error) {
    console.error("Delete email template error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete template",
    };
  }
}
