"use server";

import { getDb } from "@/lib/env";
import { users, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { sendPasswordResetEmail } from "@/lib/email";
import { z } from "zod";
import { headers } from "next/headers";

const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordResult =
  | { error: string; fieldErrors: Record<string, string> }
  | { success: true };

export async function forgotPasswordAction(
  formData: FormData
): Promise<ForgotPasswordResult> {
  const rawData = {
    email: formData.get("email") as string,
  };

  const parsed = forgotPasswordSchema.safeParse(rawData);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    });
    return { error: "Validation failed", fieldErrors };
  }

  const db = getDb();

  // Find user by email
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase()))
    .limit(1);

  // Always return success to prevent email enumeration attacks
  if (userResult.length === 0) {
    return { success: true };
  }

  const user = userResult[0];

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
    return {
      error: "Failed to send password reset email. Please try again.",
      fieldErrors: {},
    };
  }

  return { success: true };
}
