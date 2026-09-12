import { z } from "zod";
import { containsProfanity } from "@/lib/profanity";

export const loginSchema = z.object({
  email: z
    .string({ error: "Email is required" })
    .email({ message: "Email must be a valid email." }),
  password: z.string({ error: "Password is required" }),
});

export const registerSchema = z
  .object({
    name: z
      .string({ error: "Name is required" })
      .regex(/^[a-zA-z\s]*$/, {
        message: "Name can only contain letters and spaces.",
      })
      .min(2, { message: "Name must be at least 2 characters" })
      .max(64, { message: "Name must be less than 64 characters" })
      .trim(),
    username: z
      .string({ error: "Username is required" })
      .min(3, { message: "Username must be at least 3 characters" })
      .max(15, { message: "Username must be 15 characters or less" })
      .refine((val) => val === val.trim(), {
        message: "Username cannot start or end with spaces",
      })
      .refine((val) => !containsProfanity(val), {
        message: "Username contains language that isn't allowed",
      }),
    email: z
      .string({ error: "Email is required" })
      .email({ message: "Email must be a valid email" }),
    password: z
      .string({ error: "Password is required" })
      .regex(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/, {
        message:
          "Password must be a minimum of 8 characters & contain at least one letter, one number, and one special character.",
      }),
    passwordConfirm: z.string({ error: "Confirm Password is required" }),
    invitationCode: z
      .string({ error: "Invitation code is required" })
      .min(1, { message: "Invitation code is required" }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords must match",
    path: ["passwordConfirm"],
  });

export const createPickSchema = z.object({
  gameId: z
    .string({ error: "gameId is required" })
    .min(1, { message: "gameId is required" }),
  teamId: z
    .string({ error: "teamId is required" })
    .min(1, { message: "teamId is required" }),
  weekNumber: z.coerce
    .number({ error: "weekNumber is required" })
    .min(1)
    .max(18),
  seasonType: z.coerce
    .number({ error: "seasonType is required" })
    .min(1)
    .max(3),
});

export const updateProfileSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .min(1, { message: "Name is required" })
    .max(64, { message: "Name must be 64 characters or less" })
    .trim(),
});

export const updateEmailSchema = z.object({
  email: z
    .string({ error: "Email is required" })
    .email({ message: "Email must be a valid email" }),
});

export const updateUsernameSchema = z.object({
  username: z
    .string({ error: "Username is required" })
    .min(3, { message: "Username must be at least 3 characters" })
    .max(15, { message: "Username must be 15 characters or less" })
    .refine((val) => val === val.trim(), {
      message: "Username cannot start or end with spaces",
    })
    .refine((val) => !containsProfanity(val), {
      message: "Username contains language that isn't allowed",
    }),
});

export const updatePasswordSchema = z
  .object({
    oldPassword: z.string({ error: "Old password is required" }),
    password: z
      .string({ error: "Password is required" })
      .regex(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/, {
        message:
          "Password must be a minimum of 8 characters & contain at least one letter, one number, and one special character.",
      }),
    passwordConfirm: z.string({ error: "Confirm Password is required" }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords must match",
    path: ["passwordConfirm"],
  });

export const createProjectSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .min(1, { message: "Name is required" })
    .max(64, { message: "Name must be 64 characters or less" })
    .trim(),
  tagline: z
    .string({ error: "Tagline is required" })
    .min(1, { message: "Tagline is required" })
    .max(64, { message: "Tagline must be 64 characters or less" })
    .trim(),
  url: z
    .string({ error: "URL is required" })
    .url({ message: "URL must be a valid URL" }),
  description: z
    .string({ error: "Description is required" })
    .min(1, { message: "Description is required" })
    .max(512, { message: "Description must be less than 512 characters" })
    .trim(),
});

// Avatar upload schema - validates base64 data URL
export const avatarSchema = z.object({
  avatar: z
    .string({ error: "Avatar is required" })
    .refine(
      (val) => val.startsWith("data:image/"),
      { message: "Avatar must be a valid image data URL" }
    )
    .refine(
      (val) => {
        // Max 500KB for base64 (after decoding, the image is ~375KB)
        // base64 is roughly 4/3 larger than binary
        const base64Data = val.split(",")[1];
        return base64Data ? base64Data.length <= 500 * 1024 * 1.34 : false;
      },
      { message: "Avatar must be less than 500KB" }
    ),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreatePickInput = z.infer<typeof createPickSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
export type UpdateUsernameInput = z.infer<typeof updateUsernameSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type AvatarInput = z.infer<typeof avatarSchema>;
