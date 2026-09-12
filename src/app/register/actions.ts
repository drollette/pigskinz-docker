"use server";

import { registerUser } from "@/lib/auth";
import { registerSchema } from "@/lib/schemas";
import { getDb, getEnv } from "@/lib/env";
import { emailVerificationCodes, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { ensureGeneratedAvatar } from "@/lib/avatar-generation";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "@/lib/email";

const VERIFICATION_CODE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export async function registerAction(formData: FormData) {
  const rawData = {
    name: formData.get("name") as string,
    username: formData.get("username") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    passwordConfirm: formData.get("passwordConfirm") as string,
    invitationCode: formData.get("invitationCode") as string,
  };

  const parsed = registerSchema.safeParse(rawData);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    });
    return { error: "Validation failed", fieldErrors };
  }

  if (parsed.data.invitationCode.trim() !== getEnv().INVITATION_CODE) {
    return {
      error: "Validation failed",
      fieldErrors: { invitationCode: "Invalid invitation code" },
    };
  }

  try {
    const { userId } = await registerUser(
      parsed.data.name,
      parsed.data.username,
      parsed.data.email,
      parsed.data.password
    );

    // Best-effort: persists a default avatar so this account never depends
    // on a live third-party fetch to render one. Never blocks registration
    // on a DiceBear hiccup (see ensureGeneratedAvatar).
    await ensureGeneratedAvatar(userId, parsed.data.username);

    // Generate and save verification code
    const code = generateVerificationCode();
    const db = getDb();

    await db.insert(emailVerificationCodes).values({
      id: generateId(),
      userId,
      email: parsed.data.email.toLowerCase(),
      code,
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MS),
    });

    // Send verification email
    await sendVerificationEmail(
      parsed.data.email,
      code,
      parsed.data.name
    );

    return { success: true, userId, email: parsed.data.email.toLowerCase() };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Registration failed",
    };
  }
}

export async function resendVerificationCodeAction(email: string) {
  const db = getDb();

  // Find user by email
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (userResult.length === 0) {
    return { error: "User not found" };
  }

  const user = userResult[0];

  if (user.emailVerified) {
    return { error: "Email already verified" };
  }

  // Delete any existing verification codes for this user
  await db
    .delete(emailVerificationCodes)
    .where(eq(emailVerificationCodes.userId, user.id));

  // Generate new code
  const code = generateVerificationCode();

  await db.insert(emailVerificationCodes).values({
    id: generateId(),
    userId: user.id,
    email: email.toLowerCase(),
    code,
    expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MS),
  });

  // Send verification email
  try {
    await sendVerificationEmail(email, code, user.name);
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return { error: "Failed to send verification email. Please try again." };
  }

  return { success: true };
}
