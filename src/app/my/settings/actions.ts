"use server";

import { requireAuth } from "@/lib/auth";
import {
  updateUserProfile,
  updateUserEmail,
  updateUserUsername,
} from "@/lib/auth";
import {
  updateProfileSchema,
  updateEmailSchema,
  updateUsernameSchema,
  avatarSchema,
} from "@/lib/schemas";
import { getDb } from "@/lib/env";
import { pendingEmailChanges, users, passwordResetTokens, pushSubscriptions } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import {
  generateVerificationCode,
  sendEmailChangeVerification,
  sendPasswordResetEmail,
} from "@/lib/email";
import { z } from "zod";
import { headers } from "next/headers";
import type { UserPreferences } from "@/db/schema";

const VERIFICATION_CODE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export async function updateProfileAction(formData: FormData) {
  const user = await requireAuth();

  const rawData = {
    name: formData.get("name") as string,
  };

  const parsed = updateProfileSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await updateUserProfile(user.id, { name: parsed.data.name });
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Update failed",
    };
  }
}

type UpdateEmailResult =
  | { error: string }
  | { success: true; requiresVerification: true; newEmail: string };

export async function updateEmailAction(
  formData: FormData
): Promise<UpdateEmailResult> {
  const user = await requireAuth();

  const rawData = {
    email: formData.get("email") as string,
  };

  const parsed = updateEmailSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const newEmail = parsed.data.email.toLowerCase();

  // Check if email is the same as current
  if (newEmail === user.email.toLowerCase()) {
    return { error: "This is already your email address" };
  }

  const db = getDb();

  // Check if email is already taken by another user
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, newEmail))
    .limit(1);

  if (existingUser.length > 0) {
    return { error: "This email is already in use" };
  }

  // Delete any existing pending email changes for this user
  await db
    .delete(pendingEmailChanges)
    .where(eq(pendingEmailChanges.userId, user.id));

  // Generate verification code and store pending change
  const code = generateVerificationCode();

  await db.insert(pendingEmailChanges).values({
    id: generateId(),
    userId: user.id,
    newEmail,
    code,
    expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MS),
  });

  // Send verification email to the new address
  try {
    await sendEmailChangeVerification(newEmail, code, user.name);
  } catch (error) {
    console.error("Failed to send email change verification:", error);
    return { error: "Failed to send verification email. Please try again." };
  }

  return { success: true, requiresVerification: true, newEmail };
}

const verifyEmailChangeSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d+$/, "Code must contain only numbers"),
});

type VerifyEmailChangeResult = { error: string } | { success: true };

export async function verifyEmailChangeAction(
  formData: FormData
): Promise<VerifyEmailChangeResult> {
  const user = await requireAuth();

  const rawData = {
    code: formData.get("code") as string,
  };

  const parsed = verifyEmailChangeSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const db = getDb();

  // Find valid pending email change
  const pendingChange = await db
    .select()
    .from(pendingEmailChanges)
    .where(
      and(
        eq(pendingEmailChanges.userId, user.id),
        eq(pendingEmailChanges.code, parsed.data.code),
        gt(pendingEmailChanges.expiresAt, new Date())
      )
    )
    .limit(1);

  if (pendingChange.length === 0) {
    return { error: "Invalid or expired verification code" };
  }

  const change = pendingChange[0];

  // Check again that the new email isn't taken (race condition protection)
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, change.newEmail))
    .limit(1);

  if (existingUser.length > 0) {
    // Delete the pending change since it's no longer valid
    await db
      .delete(pendingEmailChanges)
      .where(eq(pendingEmailChanges.id, change.id));
    return { error: "This email is already in use" };
  }

  // Update the user's email
  await updateUserEmail(user.id, change.newEmail);

  // Delete the pending change
  await db
    .delete(pendingEmailChanges)
    .where(eq(pendingEmailChanges.id, change.id));

  return { success: true };
}

export async function cancelEmailChangeAction(): Promise<VerifyEmailChangeResult> {
  const user = await requireAuth();

  const db = getDb();

  await db
    .delete(pendingEmailChanges)
    .where(eq(pendingEmailChanges.userId, user.id));

  return { success: true };
}

export async function resendEmailChangeCodeAction(): Promise<VerifyEmailChangeResult> {
  const user = await requireAuth();

  const db = getDb();

  // Find existing pending change
  const pendingChange = await db
    .select()
    .from(pendingEmailChanges)
    .where(eq(pendingEmailChanges.userId, user.id))
    .limit(1);

  if (pendingChange.length === 0) {
    return { error: "No pending email change found" };
  }

  const change = pendingChange[0];

  // Generate new code
  const code = generateVerificationCode();

  // Update the pending change with new code and expiry
  await db
    .update(pendingEmailChanges)
    .set({
      code,
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MS),
    })
    .where(eq(pendingEmailChanges.id, change.id));

  // Send new verification email
  try {
    await sendEmailChangeVerification(change.newEmail, code, user.name);
  } catch (error) {
    console.error("Failed to send email change verification:", error);
    return { error: "Failed to send verification email. Please try again." };
  }

  return { success: true };
}

export async function updateUsernameAction(formData: FormData) {
  const user = await requireAuth();

  const rawData = {
    username: formData.get("username") as string,
  };

  const parsed = updateUsernameSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await updateUserUsername(user.id, parsed.data.username);
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Update failed",
    };
  }
}

type SendPasswordResetResult = { error: string } | { success: true };

export async function sendPasswordResetLinkAction(): Promise<SendPasswordResetResult> {
  const user = await requireAuth();

  const db = getDb();

  // Delete any existing reset tokens for this user
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id));

  // Generate new reset token
  const token = generateId();

  await db.insert(passwordResetTokens).values({
    id: token,
    userId: user.id,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS),
  });

  // Build reset URL
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const resetUrl = `${protocol}://${host}/reset-password?token=${token}`;

  // Send password reset email
  try {
    await sendPasswordResetEmail(user.email, resetUrl, user.name);
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return { error: "Failed to send password reset email. Please try again." };
  }

  return { success: true };
}

export async function updateAvatarAction(avatarBase64: string) {
  const user = await requireAuth();

  const parsed = avatarSchema.safeParse({ avatar: avatarBase64 });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    // A real upload -- avatarIsGenerated must flip back to false, or a
    // later username change (see updateUserUsername) would think this is
    // still a generated placeholder it's free to overwrite.
    await updateUserProfile(user.id, { avatar: parsed.data.avatar, avatarIsGenerated: false });
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Update failed",
    };
  }
}

const themeSchema = z.enum(["light", "dark", "system"]);

type UpdateThemeResult = { error: string } | { success: true };

export async function updateThemeAction(
  theme: string
): Promise<UpdateThemeResult> {
  const user = await requireAuth();

  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) {
    return { error: "Invalid theme selection" };
  }

  const db = getDb();

  try {
    // Get current preferences and merge with new theme
    const currentPreferences = (user.preferences ?? {}) as UserPreferences;
    const newPreferences: UserPreferences = {
      ...currentPreferences,
      theme: parsed.data,
    };

    await db
      .update(users)
      .set({
        preferences: newPreferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Update failed",
    };
  }
}

const autoPickSchema = z.object({
  enabled: z.boolean(),
  strategy: z.enum(["home", "away", "spread", "underdog", "random"]),
});

type UpdateAutoPickResult = { error: string } | { success: true };

export async function updateAutoPickAction(
  enabled: boolean,
  strategy: string
): Promise<UpdateAutoPickResult> {
  const user = await requireAuth();

  const parsed = autoPickSchema.safeParse({ enabled, strategy });
  if (!parsed.success) {
    return { error: "Invalid auto-pick settings" };
  }

  const db = getDb();

  try {
    const currentPreferences = (user.preferences ?? {}) as UserPreferences;
    const newPreferences: UserPreferences = {
      ...currentPreferences,
      autoPick: parsed.data,
    };

    await db
      .update(users)
      .set({
        preferences: newPreferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Update failed",
    };
  }
}

const emailNotificationsSchema = z.object({
  enabled: z.boolean(),
  pickReminders: z.boolean(),
  autoPickDigest: z.boolean(),
  lockerRoomMentions: z.boolean(),
  weekResults: z.boolean(),
});

type UpdateEmailNotificationsResult = { error: string } | { success: true };

export async function updateEmailNotificationsAction(
  enabled: boolean,
  pickReminders: boolean,
  autoPickDigest: boolean,
  lockerRoomMentions: boolean,
  weekResults: boolean
): Promise<UpdateEmailNotificationsResult> {
  const user = await requireAuth();

  const parsed = emailNotificationsSchema.safeParse({
    enabled,
    pickReminders,
    autoPickDigest,
    lockerRoomMentions,
    weekResults,
  });
  if (!parsed.success) {
    return { error: "Invalid email notification settings" };
  }

  const db = getDb();

  try {
    const currentPreferences = (user.preferences ?? {}) as UserPreferences;
    const newPreferences: UserPreferences = {
      ...currentPreferences,
      emailNotifications: parsed.data,
    };

    await db
      .update(users)
      .set({
        preferences: newPreferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Update failed",
    };
  }
}

const pushNotificationsSchema = z.object({
  enabled: z.boolean(),
  missingPicks: z.boolean(),
  lockerRoomReplies: z.boolean(),
  weekResults: z.boolean(),
  autoPickDigest: z.boolean(),
});

type UpdatePushNotificationsResult = { error: string } | { success: true };

export async function updatePushNotificationsAction(
  enabled: boolean,
  missingPicks: boolean,
  lockerRoomReplies: boolean,
  weekResults: boolean,
  autoPickDigest: boolean
): Promise<UpdatePushNotificationsResult> {
  const user = await requireAuth();

  const parsed = pushNotificationsSchema.safeParse({
    enabled,
    missingPicks,
    lockerRoomReplies,
    weekResults,
    autoPickDigest,
  });
  if (!parsed.success) {
    return { error: "Invalid push notification settings" };
  }

  const db = getDb();

  try {
    const currentPreferences = (user.preferences ?? {}) as UserPreferences;
    const newPreferences: UserPreferences = {
      ...currentPreferences,
      pushNotifications: parsed.data,
    };

    await db
      .update(users)
      .set({
        preferences: newPreferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Update failed",
    };
  }
}

const subscribePushSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional(),
});

type SubscribePushResult = { error: string } | { success: true; id: string };

/**
 * Upserts on `endpoint` (unique) rather than inserting blindly -- the same
 * device re-subscribing (its keys can rotate, e.g. after clearing site
 * data) should update the existing row, not accumulate duplicates that
 * would each get their own copy of every push.
 */
export async function subscribePushAction(
  subscription: unknown
): Promise<SubscribePushResult> {
  const user = await requireAuth();

  const parsed = subscribePushSchema.safeParse(subscription);
  if (!parsed.success) {
    return { error: "Invalid push subscription" };
  }

  const db = getDb();

  try {
    const [row] = await db
      .insert(pushSubscriptions)
      .values({
        id: generateId(),
        userId: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        userAgent: parsed.data.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: user.id,
          p256dh: parsed.data.p256dh,
          auth: parsed.data.auth,
          userAgent: parsed.data.userAgent ?? null,
          lastFailedAt: null,
        },
      })
      .returning({ id: pushSubscriptions.id });

    return { success: true, id: row.id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Subscribe failed",
    };
  }
}

type UnsubscribePushResult = { error: string } | { success: true };

export async function unsubscribePushAction(
  subscriptionId: string
): Promise<UnsubscribePushResult> {
  const user = await requireAuth();

  const db = getDb();

  try {
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.id, subscriptionId), eq(pushSubscriptions.userId, user.id)));

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Remove failed",
    };
  }
}
