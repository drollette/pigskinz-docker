"use server";

import { getDb } from "@/lib/env";
import { emailVerificationCodes, users } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { createSession } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";
import { z } from "zod";

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d+$/, "Code must contain only numbers"),
});

export async function verifyEmailAction(formData: FormData) {
  const rawData = {
    email: formData.get("email") as string,
    code: formData.get("code") as string,
  };

  const parsed = verifyCodeSchema.safeParse(rawData);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    });
    return { error: "Validation failed", fieldErrors };
  }

  const db = getDb();

  // Find valid verification code
  const codeResult = await db
    .select()
    .from(emailVerificationCodes)
    .where(
      and(
        eq(emailVerificationCodes.email, parsed.data.email.toLowerCase()),
        eq(emailVerificationCodes.code, parsed.data.code),
        gt(emailVerificationCodes.expiresAt, new Date())
      )
    )
    .limit(1);

  if (codeResult.length === 0) {
    return { error: "Invalid or expired verification code" };
  }

  const verificationCode = codeResult[0];

  // Mark email as verified
  await db
    .update(users)
    .set({
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, verificationCode.userId));

  // Delete the verification code
  await db
    .delete(emailVerificationCodes)
    .where(eq(emailVerificationCodes.id, verificationCode.id));

  // Create session to log the user in
  await createSession(verificationCode.userId);

  // Welcome email covers the buy-in/LeagueSafe info new users need — sent
  // once here rather than on every login, and never lets a delivery
  // failure block verification (the user is already logged in by now).
  try {
    const userResult = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, verificationCode.userId))
      .limit(1);

    if (userResult[0]) {
      await sendWelcomeEmail(verificationCode.email, userResult[0].name);
    }
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }

  return { success: true };
}
