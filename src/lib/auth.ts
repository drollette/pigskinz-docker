import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDb } from "./env";
import { sessions, users } from "@/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import {
  generateId,
  hashPassword,
  verifyPassword,
} from "./utils";
import { ensureGeneratedAvatar } from "./avatar-generation";

const SESSION_COOKIE_NAME = "session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  // cookies().set() is documented to invalidate the client Router Cache on
  // its own, but that hasn't held up in practice for the login/verify-email
  // flows here: they read the new cookie via getCurrentUser() in the root
  // layout, then redirect client-side with router.push()+router.refresh()
  // rather than a server-side redirect() call, and users have repeatedly
  // landed back on what looks like a logged-out page after signing in
  // (confirmed a real session row was created every time; only a full page
  // reload picked it up). Explicitly revalidating the root layout closes
  // that gap regardless of which route the caller redirects to next.
  revalidatePath("/", "layout");

  return sessionId;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) return null;

  const db = getDb();
  const result = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (result.length === 0) return null;

  return {
    session: result[0].session,
    user: result[0].user,
  };
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (!user.isAdmin) {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  revalidatePath("/", "layout");
}

export async function registerUser(
  name: string,
  username: string,
  email: string,
  password: string
) {
  const db = getDb();

  // Check if email already exists
  const existingEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existingEmail.length > 0) {
    throw new Error("Email already registered");
  }

  // Case-insensitive: "username" isn't COLLATE NOCASE at the schema level
  // (case-sensitively unique there), but two usernames differing only by
  // case would be indistinguishable to @mention matching in the Locker
  // Room (deliberately case-insensitive there) and to anyone reading them
  // aloud, so reject the collision here instead.
  const existingUsername = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);

  if (existingUsername.length > 0) {
    throw new Error("Username already taken");
  }

  const userId = generateId();
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    name,
    username,
    passwordHash,
    emailVerified: false,
  });

  return { userId, username };
}

export async function loginUser(email: string, password: string) {
  const db = getDb();

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (result.length === 0) {
    throw new Error("Invalid email or password");
  }

  const user = result[0];

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  await createSession(user.id);

  return user;
}

export async function updateUserProfile(
  userId: string,
  data: { name?: string; avatar?: string; avatarIsGenerated?: boolean }
) {
  const db = getDb();

  await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function updateUserEmail(userId: string, email: string) {
  const db = getDb();

  // Check if email already exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0 && existing[0].id !== userId) {
    throw new Error("Email already in use");
  }

  await db
    .update(users)
    .set({
      email: email.toLowerCase(),
      emailVerified: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function updateUserUsername(userId: string, username: string) {
  const db = getDb();

  // Case-insensitive -- see the same check in registerUser above.
  const existing = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);

  if (existing.length > 0 && existing[0].id !== userId) {
    throw new Error("Username already taken");
  }

  await db
    .update(users)
    .set({
      username,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // The identicon is seeded from the username, so a rename leaves the old
  // one mismatched -- regenerate it, but only if it was ever auto-generated
  // in the first place (never touches a real upload; see
  // ensureGeneratedAvatar's WHERE clause). Best-effort, never throws.
  await ensureGeneratedAvatar(userId, username);
}

export async function updateUserPassword(
  userId: string,
  oldPassword: string,
  newPassword: string
) {
  const db = getDb();

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (result.length === 0) {
    throw new Error("User not found");
  }

  const user = result[0];
  const isValid = await verifyPassword(oldPassword, user.passwordHash);

  if (!isValid) {
    throw new Error("Current password is incorrect");
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
