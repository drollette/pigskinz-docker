"use server";

import { getDb } from "@/lib/env";
import { users, emailVerificationCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession } from "@/lib/auth";
import { verifyPassword, generateId } from "@/lib/utils";
import { loginSchema } from "@/lib/schemas";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "@/lib/email";

const VERIFICATION_CODE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export async function loginAction(formData: FormData) {
  const rawData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(rawData);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    });
    return { error: "Validation failed", fieldErrors };
  }

  const db = getDb();

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase()))
    .limit(1);

  if (result.length === 0) {
    return { error: "Invalid email or password" };
  }

  const user = result[0];

  const isValid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!isValid) {
    return { error: "Invalid email or password" };
  }

  // Check if email is verified
  if (!user.emailVerified) {
    // Generate and send new verification code
    await db
      .delete(emailVerificationCodes)
      .where(eq(emailVerificationCodes.userId, user.id));

    const code = generateVerificationCode();

    await db.insert(emailVerificationCodes).values({
      id: generateId(),
      userId: user.id,
      email: user.email,
      code,
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MS),
    });

    try {
      await sendVerificationEmail(user.email, code, user.name);
    } catch (error) {
      console.error("Failed to send verification email:", error);
      return { error: "Failed to send verification email. Please try again." };
    }

    return {
      error: "Email not verified",
      requiresVerification: true,
      email: user.email,
    };
  }

  await createSession(user.id);

  return { success: true };
}
