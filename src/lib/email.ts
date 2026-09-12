import { getEnv, type AppEnv } from "./env";
import { SITE_URL, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME, POOL_NAME, LEAGUESAFE_URL, BUYIN_AMOUNT, BUYIN_DEADLINE, PAYOUT_INFO } from "./site-config";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  // Lets a recipient hit "Reply" in their own email client and have it go
  // straight to this address instead of ${EMAIL_FROM_ADDRESS} -- used for the
  // Locker Room admin-alert email so an admin can respond directly to the
  // player who @mentioned them, entirely through normal email (no inbound
  // parsing on our side needed, since the reply never comes back to us).
  replyTo?: { email: string; name: string };
}

export async function sendEmail(
  { to, subject, html, text, replyTo }: SendEmailParams,
  env: AppEnv = getEnv()
) {
  const apiKey = env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.error("SENDGRID_API_KEY is not configured");
    throw new Error("Email service is not configured");
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: EMAIL_FROM_ADDRESS, name: EMAIL_FROM_NAME },
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      content: [
        ...(text ? [{ type: "text/plain", value: text }] : []),
        { type: "text/html", value: html },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("SendGrid error:", response.status, errorText);
    throw new Error("Failed to send email");
  }
}

export function generateVerificationCode(): string {
  // Generate a 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

export function getVerificationEmailHtml(code: string, name: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background-color: #1d4ed8; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${POOL_NAME}</h1>
    </div>
    <div style="padding: 32px 24px;">
      <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px;">Verify your email</h2>
      <p style="color: #3f3f46; margin: 0 0 24px 0; line-height: 1.5;">
        Hi ${name},<br><br>
        Enter the following verification code to complete your registration:
      </p>
      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #18181b;">${code}</span>
      </div>
      <p style="color: #71717a; margin: 0; font-size: 14px; line-height: 1.5;">
        This code will expire in 15 minutes.<br>
        If you didn't create an account, you can safely ignore this email.
      </p>
    </div>
    <div style="background-color: #f4f4f5; padding: 16px 24px; text-align: center;">
      <p style="color: #71717a; margin: 0; font-size: 12px;">
        &copy; ${new Date().getFullYear()} ${POOL_NAME}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getVerificationEmailText(code: string, name: string): string {
  return `
Hi ${name},

Enter the following verification code to complete your registration:

${code}

This code will expire in 15 minutes.

If you didn't create an account, you can safely ignore this email.

- ${POOL_NAME}
  `.trim();
}

export function getPasswordResetEmailHtml(
  resetUrl: string,
  name: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background-color: #1d4ed8; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${POOL_NAME}</h1>
    </div>
    <div style="padding: 32px 24px;">
      <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px;">Reset your password</h2>
      <p style="color: #3f3f46; margin: 0 0 24px 0; line-height: 1.5;">
        Hi ${name},<br><br>
        We received a request to reset your password. Click the button below to create a new password:
      </p>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${resetUrl}" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500;">
          Reset Password
        </a>
      </div>
      <p style="color: #71717a; margin: 0 0 16px 0; font-size: 14px; line-height: 1.5;">
        Or copy and paste this link into your browser:
      </p>
      <p style="color: #3b82f6; margin: 0 0 24px 0; font-size: 14px; word-break: break-all;">
        ${resetUrl}
      </p>
      <p style="color: #71717a; margin: 0; font-size: 14px; line-height: 1.5;">
        This link will expire in 1 hour.<br>
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
    <div style="background-color: #f4f4f5; padding: 16px 24px; text-align: center;">
      <p style="color: #71717a; margin: 0; font-size: 12px;">
        &copy; ${new Date().getFullYear()} ${POOL_NAME}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getPasswordResetEmailText(
  resetUrl: string,
  name: string
): string {
  return `
Hi ${name},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

- ${POOL_NAME}
  `.trim();
}

export async function sendVerificationEmail(
  email: string,
  code: string,
  name: string
) {
  await sendEmail({
    to: email,
    subject: `Verify your ${POOL_NAME} account`,
    html: getVerificationEmailHtml(code, name),
    text: getVerificationEmailText(code, name),
  });
}

export function getWelcomeEmailHtml(name: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background-color: #1d4ed8; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${POOL_NAME}</h1>
    </div>
    <div style="padding: 32px 24px;">
      <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px;">Welcome to ${POOL_NAME}!</h2>
      <p style="color: #3f3f46; margin: 0 0 16px 0; line-height: 1.5;">
        Hi ${name}, you're in! Pick the straight-up winner of every NFL game each week, predict
        the tiebreaker game's combined score, and climb the season standings.
      </p>
      ${
        LEAGUESAFE_URL
          ? `<div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #18181b; margin: 0 0 8px 0; font-size: 16px;">Buy-In</h3>
        <p style="color: #3f3f46; margin: 0 0 12px 0; line-height: 1.5; font-size: 14px;">
          ${BUYIN_AMOUNT ? `${BUYIN_AMOUNT} for the season, collected` : "Collected"} through <strong>LeagueSafe</strong> — the top-rated,
          trusted platform for fantasy sports pools since 2008.
        </p>
        ${
          BUYIN_DEADLINE
            ? `<p style="color: #3f3f46; margin: 0 0 16px 0; line-height: 1.5; font-size: 14px;">
          Buy-in is due by <strong>${BUYIN_DEADLINE}</strong>. LeagueSafe does not accept payments
          after the deadline, so don't wait until the last minute.
        </p>`
            : ""
        }
        <div style="text-align: center;">
          <a href="${LEAGUESAFE_URL}" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 500; font-size: 14px;">
            Pay Your Buy-In
          </a>
        </div>
      </div>`
          : ""
      }
      <p style="color: #3f3f46; margin: 0 0 24px 0; line-height: 1.5; font-size: 14px;">
        ${PAYOUT_INFO}
      </p>
      <div style="text-align: center;">
        <a href="${SITE_URL}/rules" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500;">
          See Full Rules
        </a>
      </div>
    </div>
    <div style="background-color: #f4f4f5; padding: 16px 24px; text-align: center;">
      <p style="color: #71717a; margin: 0; font-size: 12px;">
        &copy; ${new Date().getFullYear()} ${POOL_NAME}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getWelcomeEmailText(name: string): string {
  return `
Hi ${name},

Welcome to ${POOL_NAME}! Pick the straight-up winner of every NFL game each week, predict the tiebreaker game's combined score, and climb the season standings.
${
  LEAGUESAFE_URL
    ? `
BUY-IN
${BUYIN_AMOUNT ? `${BUYIN_AMOUNT} for the season, collected` : "Collected"} through LeagueSafe — the top-rated, trusted platform for fantasy sports pools since 2008.
${BUYIN_DEADLINE ? `\nBuy-in is due by ${BUYIN_DEADLINE}. LeagueSafe does not accept payments after the deadline, so don't wait until the last minute.\n` : ""}
Pay your buy-in: ${LEAGUESAFE_URL}
`
    : ""
}
PAYOUTS
${PAYOUT_INFO}

Full rules: ${SITE_URL}/rules

- ${POOL_NAME}
  `.trim();
}

export async function sendWelcomeEmail(email: string, name: string) {
  await sendEmail({
    to: email,
    subject: `Welcome to ${POOL_NAME}!`,
    html: getWelcomeEmailHtml(name),
    text: getWelcomeEmailText(name),
  });
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  name: string
) {
  await sendEmail({
    to: email,
    subject: `Reset your ${POOL_NAME} password`,
    html: getPasswordResetEmailHtml(resetUrl, name),
    text: getPasswordResetEmailText(resetUrl, name),
  });
}

export function getEmailChangeVerificationHtml(
  code: string,
  name: string,
  newEmail: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background-color: #1d4ed8; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${POOL_NAME}</h1>
    </div>
    <div style="padding: 32px 24px;">
      <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px;">Verify your new email</h2>
      <p style="color: #3f3f46; margin: 0 0 24px 0; line-height: 1.5;">
        Hi ${name},<br><br>
        Enter the following verification code to confirm <strong>${newEmail}</strong> as your new email address:
      </p>
      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #18181b;">${code}</span>
      </div>
      <p style="color: #71717a; margin: 0; font-size: 14px; line-height: 1.5;">
        This code will expire in 15 minutes.<br>
        If you didn't request this change, you can safely ignore this email.
      </p>
    </div>
    <div style="background-color: #f4f4f5; padding: 16px 24px; text-align: center;">
      <p style="color: #71717a; margin: 0; font-size: 12px;">
        &copy; ${new Date().getFullYear()} ${POOL_NAME}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getEmailChangeVerificationText(
  code: string,
  name: string,
  newEmail: string
): string {
  return `
Hi ${name},

Enter the following verification code to confirm ${newEmail} as your new email address:

${code}

This code will expire in 15 minutes.

If you didn't request this change, you can safely ignore this email.

- ${POOL_NAME}
  `.trim();
}

export async function sendEmailChangeVerification(
  newEmail: string,
  code: string,
  name: string
) {
  await sendEmail({
    to: newEmail,
    subject: "Verify your new email address",
    html: getEmailChangeVerificationHtml(code, name, newEmail),
    text: getEmailChangeVerificationText(code, name, newEmail),
  });
}

interface PickReminderGame {
  name: string;
  shortName: string | null;
  date: Date;
  seasonType: number;
  weekNumber: number;
}

// Emails render server-side on the Worker, which has no per-user timezone
// to draw on (there's no such column) and defaults to UTC — showing that
// raw was badly confusing for a US-based pool (a Wednesday-evening ET game
// reads as "Thu" and a foreign "UTC" label). NFL kickoff times are
// conventionally communicated in Eastern, so anchor to that instead; it
// won't be everyone's local time, but it matches what ESPN and the rest of
// the league already use, and avoids the day-boundary confusion UTC caused.
export function formatKickoff(date: Date): string {
  return date.toLocaleString("en-us", {
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

export function getPickReminderEmailHtml(
  name: string,
  games: PickReminderGame[]
): string {
  const rows = games
    .map(
      (g) => `
      <tr>
        <td style="padding: 8px 0; color: #18181b; border-bottom: 1px solid #f4f4f5;">${g.shortName || g.name}</td>
        <td style="padding: 8px 0; color: #71717a; text-align: right; border-bottom: 1px solid #f4f4f5; white-space: nowrap;">${formatKickoff(g.date)}</td>
      </tr>`
    )
    .join("");

  const picksUrl = `${SITE_URL}/picks/${games[0].seasonType}/${games[0].weekNumber}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background-color: #1d4ed8; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${POOL_NAME}</h1>
    </div>
    <div style="padding: 32px 24px;">
      <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px;">Don't forget to make your picks!</h2>
      <p style="color: #3f3f46; margin: 0 0 24px 0; line-height: 1.5;">
        Hi ${name}, you're missing a pick for ${games.length === 1 ? "this game" : "these games"} kicking off later today:
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        ${rows}
      </table>
      <div style="text-align: center;">
        <a href="${picksUrl}" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500;">
          Make Your Picks
        </a>
      </div>
    </div>
    <div style="background-color: #f4f4f5; padding: 16px 24px; text-align: center;">
      <p style="color: #71717a; margin: 0 0 8px 0; font-size: 12px;">
        <a href="${SITE_URL}/my/settings#email-notifications" style="color: #71717a;">Manage your email preferences</a>
      </p>
      <p style="color: #71717a; margin: 0; font-size: 12px;">
        &copy; ${new Date().getFullYear()} ${POOL_NAME}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getPickReminderEmailText(
  name: string,
  games: PickReminderGame[]
): string {
  const list = games
    .map((g) => `- ${g.shortName || g.name} (${formatKickoff(g.date)})`)
    .join("\n");

  const picksUrl = `${SITE_URL}/picks/${games[0].seasonType}/${games[0].weekNumber}`;

  return `
Hi ${name},

You're missing a pick for ${games.length === 1 ? "this game" : "these games"} kicking off later today:

${list}

Make your picks: ${picksUrl}

Manage your email preferences: ${SITE_URL}/my/settings#email-notifications

- ${POOL_NAME}
  `.trim();
}

export async function sendPickReminderEmail(
  to: string,
  name: string,
  games: PickReminderGame[],
  env: AppEnv
) {
  await sendEmail(
    {
      to,
      subject: games.length === 1
        ? "You're missing a pick for today's game"
        : `You're missing picks for ${games.length} games today`,
      html: getPickReminderEmailHtml(name, games),
      text: getPickReminderEmailText(name, games),
    },
    env
  );
}

interface AutoPickedGameSummary {
  name: string;
  shortName: string | null;
  teamAbbreviation: string;
}

interface UpcomingAutoPickGameSummary {
  name: string;
  shortName: string | null;
}

export function getAutoPickEmailHtml(
  name: string,
  games: AutoPickedGameSummary[],
  upcoming: UpcomingAutoPickGameSummary[]
): string {
  const rows = games
    .map(
      (g) => `
      <tr>
        <td style="padding: 8px 0; color: #18181b; border-bottom: 1px solid #f4f4f5;">${g.shortName || g.name}</td>
        <td style="padding: 8px 0; color: #1d4ed8; font-weight: 600; text-align: right; border-bottom: 1px solid #f4f4f5; white-space: nowrap;">${g.teamAbbreviation}</td>
      </tr>`
    )
    .join("");

  const upcomingSection =
    upcoming.length > 0
      ? `
      <p style="color: #3f3f46; margin: 24px 0 8px 0; line-height: 1.5;">
        We'll also auto-pick these for you later today if you don't pick them first:
      </p>
      <ul style="color: #3f3f46; margin: 0 0 24px 0; padding-left: 20px; line-height: 1.6;">
        ${upcoming.map((g) => `<li>${g.shortName || g.name}</li>`).join("")}
      </ul>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background-color: #1d4ed8; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${POOL_NAME}</h1>
    </div>
    <div style="padding: 32px 24px;">
      <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px;">We made ${games.length === 1 ? "a pick" : "some picks"} for you</h2>
      <p style="color: #3f3f46; margin: 0 0 24px 0; line-height: 1.5;">
        Hi ${name}, you hadn't picked ${games.length === 1 ? "this game" : "these games"} before kickoff, so auto-pick stepped in based on your settings:
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        ${rows}
      </table>
      ${upcomingSection}
      <p style="color: #71717a; margin: 0; font-size: 14px; line-height: 1.5;">
        You can change or turn off auto-pick anytime in
        <a href="${SITE_URL}/my/settings" style="color: #1d4ed8;">your account settings</a>.
      </p>
    </div>
    <div style="background-color: #f4f4f5; padding: 16px 24px; text-align: center;">
      <p style="color: #71717a; margin: 0 0 8px 0; font-size: 12px;">
        <a href="${SITE_URL}/my/settings#email-notifications" style="color: #71717a;">Manage your email preferences</a>
      </p>
      <p style="color: #71717a; margin: 0; font-size: 12px;">
        &copy; ${new Date().getFullYear()} ${POOL_NAME}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getAutoPickEmailText(
  name: string,
  games: AutoPickedGameSummary[],
  upcoming: UpcomingAutoPickGameSummary[]
): string {
  const list = games
    .map((g) => `- ${g.shortName || g.name}: ${g.teamAbbreviation}`)
    .join("\n");

  const upcomingSection =
    upcoming.length > 0
      ? `\n\nWe'll also auto-pick these for you later today if you don't pick them first:\n${upcoming
          .map((g) => `- ${g.shortName || g.name}`)
          .join("\n")}`
      : "";

  return `
Hi ${name},

You hadn't picked ${games.length === 1 ? "this game" : "these games"} before kickoff, so auto-pick stepped in based on your settings:

${list}${upcomingSection}

You can change or turn off auto-pick anytime in your account settings: ${SITE_URL}/my/settings

Manage your email preferences: ${SITE_URL}/my/settings#email-notifications

- ${POOL_NAME}
  `.trim();
}

export async function sendAutoPickEmail(
  to: string,
  name: string,
  games: AutoPickedGameSummary[],
  upcoming: UpcomingAutoPickGameSummary[],
  env: AppEnv
) {
  await sendEmail(
    {
      to,
      subject: games.length === 1
        ? "A pick was made for you"
        : `${games.length} picks were made for you`,
      html: getAutoPickEmailHtml(name, games, upcoming),
      text: getAutoPickEmailText(name, games, upcoming),
    },
    env
  );
}

/** Escapes a plain-text string for safe embedding in an HTML email --
 * chat message bodies are free-form user text (profanity-filtered, but
 * never sanitized as HTML like the admin broadcast body is), so this is
 * needed before dropping one into a template literal. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type LockerRoomNotificationKind = "mention" | "reply";

function getLockerRoomNotificationEmailHtml(
  name: string,
  fromName: string,
  messageBody: string,
  kind: LockerRoomNotificationKind,
  hasReplyTo: boolean
): string {
  const headline =
    kind === "reply" ? `${fromName} replied to you` : `${fromName} mentioned you`;
  const lockerRoomUrl = `${SITE_URL}/locker-room`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background-color: #1d4ed8; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${POOL_NAME}</h1>
    </div>
    <div style="padding: 32px 24px;">
      <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px;">${headline} in the Locker Room</h2>
      <p style="color: #3f3f46; margin: 0 0 16px 0; line-height: 1.5;">
        Hi ${name},
      </p>
      <blockquote style="margin: 0 0 24px 0; padding: 12px 16px; background-color: #f4f4f5; border-left: 3px solid #1d4ed8; border-radius: 4px; color: #18181b; font-style: italic;">
        ${escapeHtml(messageBody)}
      </blockquote>
      ${
        hasReplyTo
          ? `<p style="color: #3f3f46; margin: 0 0 16px 0; line-height: 1.5; font-size: 14px;">
        Just reply to this email to respond directly to ${escapeHtml(fromName)}.
      </p>`
          : ""
      }
      <div style="text-align: center; margin-bottom: 8px;">
        <a href="${lockerRoomUrl}" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 500; font-size: 14px;">
          Open Locker Room
        </a>
      </div>
    </div>
    <div style="background-color: #f4f4f5; padding: 16px 24px; text-align: center;">
      <p style="color: #71717a; margin: 0 0 8px 0; font-size: 12px;">
        <a href="${SITE_URL}/my/settings#email-notifications" style="color: #71717a;">Manage your email preferences</a>
      </p>
      <p style="color: #71717a; margin: 0; font-size: 12px;">
        &copy; ${new Date().getFullYear()} ${POOL_NAME}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function getLockerRoomNotificationEmailText(
  name: string,
  fromName: string,
  messageBody: string,
  kind: LockerRoomNotificationKind,
  hasReplyTo: boolean
): string {
  const headline = kind === "reply" ? `${fromName} replied to you` : `${fromName} mentioned you`;

  return `
Hi ${name},

${headline} in the Locker Room:

"${messageBody}"
${hasReplyTo ? `\nJust reply to this email to respond directly to ${fromName}.\n` : ""}
Open Locker Room: ${SITE_URL}/locker-room

Manage your email preferences: ${SITE_URL}/my/settings#email-notifications

- ${POOL_NAME}
  `.trim();
}

export async function sendLockerRoomNotificationEmail(
  to: string,
  name: string,
  fromName: string,
  messageBody: string,
  kind: LockerRoomNotificationKind,
  env: AppEnv,
  // The sender's own address, set as Reply-To -- these notifications only
  // ever go to admins now, and hitting "Reply" in a normal email client
  // should go straight to the player who was trying to get their
  // attention, not back to ${EMAIL_FROM_ADDRESS}.
  from?: { email: string; name: string }
) {
  await sendEmail(
    {
      to,
      subject: kind === "reply" ? `${fromName} replied to you in the Locker Room` : `${fromName} mentioned you in the Locker Room`,
      html: getLockerRoomNotificationEmailHtml(name, fromName, messageBody, kind, !!from),
      text: getLockerRoomNotificationEmailText(name, fromName, messageBody, kind, !!from),
      replyTo: from,
    },
    env
  );
}

/**
 * Strips HTML tags for a plain-text fallback of admin-authored rich-text
 * content. Good enough for the handful of tags RichTextEditor's toolbar
 * produces (bold/italic/underline/lists/links/paragraphs) — not a general
 * HTML-to-text converter.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/(p|li|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getAdminBroadcastEmailHtml(
  name: string,
  subject: string,
  bodyHtml: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background-color: #1d4ed8; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${POOL_NAME}</h1>
    </div>
    <div style="padding: 32px 24px;">
      <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px;">${subject}</h2>
      <p style="color: #3f3f46; margin: 0 0 8px 0; line-height: 1.5;">Hi ${name},</p>
      <div style="color: #3f3f46; line-height: 1.5;">
        ${bodyHtml}
      </div>
    </div>
    <div style="background-color: #f4f4f5; padding: 16px 24px; text-align: center;">
      <p style="color: #71717a; margin: 0; font-size: 12px;">
        &copy; ${new Date().getFullYear()} ${POOL_NAME}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getAdminBroadcastEmailText(name: string, bodyHtml: string): string {
  return `
Hi ${name},

${htmlToPlainText(bodyHtml)}

- ${POOL_NAME}
  `.trim();
}

export async function sendAdminBroadcastEmail(
  to: string,
  name: string,
  subject: string,
  bodyHtml: string,
  env: AppEnv
) {
  await sendEmail(
    {
      to,
      subject,
      html: getAdminBroadcastEmailHtml(name, subject, bodyHtml),
      text: getAdminBroadcastEmailText(name, bodyHtml),
    },
    env
  );
}
