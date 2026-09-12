"use server";

import { getDb } from "@/lib/env";
import { users, passwordResetTokens } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { hashPassword } from "@/lib/utils";
import { createSession } from "@/lib/auth";
import { z } from "zod";

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    password: z
      .string()
      .regex(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/, {
        message:
          "Password must be a minimum of 8 characters & contain at least one letter, one number, and one special character.",
      }),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords must match",
    path: ["passwordConfirm"],
  });

export async function resetPasswordAction(formData: FormData) {
  const rawData = {
    token: formData.get("token") as string,
    password: formData.get("password") as string,
    passwordConfirm: formData.get("passwordConfirm") as string,
  };

  const parsed = resetPasswordSchema.safeParse(rawData);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    });
    return { error: "Validation failed", fieldErrors };
  }

  const db = getDb();

  // Find valid reset token
  const tokenResult = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.id, parsed.data.token),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (tokenResult.length === 0) {
    return { error: "Invalid or expired reset link" };
  }

  const resetToken = tokenResult[0];

  // Hash new password
  const passwordHash = await hashPassword(parsed.data.password);

  // Update user's password
  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, resetToken.userId));

  // Delete the reset token
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.id, resetToken.id));

  // Create session to log the user in
  await createSession(resetToken.userId);

  return { success: true };
}

export async function validateResetToken(token: string) {
  const db = getDb();

  const tokenResult = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.id, token),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  return tokenResult.length > 0;
}
