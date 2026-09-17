import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export type AutoPickStrategy = "home" | "away" | "spread" | "underdog" | "random";

// The interchangeable "views" a content page can offer -- either in
// ContentShell's two side columns (the older, still-in-use pages) or, for
// pages migrated to ColumnPage, in any of its three fully equal, dropdown-
// headed columns. See src/lib/side-panels.ts.
export type SidePanelType =
  | "lockerRoom"
  | "picks"
  | "schedule"
  | "poolStandings"
  | "nflStandings"
  | "rules";

// User preferences type
export type UserPreferences = {
  theme?: "light" | "dark" | "system";
  teamTheme?: string; // Team ID for team-based theming (future feature)
  autoPick?: {
    enabled: boolean;
    strategy: AutoPickStrategy;
  };
  // All three default to true (opt-out, not opt-in) when unset, so existing
  // users keep getting the emails they already got before this setting
  // existed. `enabled` is a master switch: when false, no notification
  // email of either kind goes out regardless of the individual toggles
  // below (their stored values are preserved so re-enabling restores
  // whatever the user had chosen before).
  emailNotifications?: {
    enabled?: boolean;
    pickReminders?: boolean;
    autoPickDigest?: boolean;
    lockerRoomMentions?: boolean;
    weekResults?: boolean;
  };
  // Push, unlike email, is opt-IN by construction: a user with no rows in
  // push_subscriptions gets nothing regardless of these values, since the
  // browser's own permission prompt is the real gate. These only matter
  // once at least one subscription exists, to let a subscribed user quiet
  // specific categories without revoking permission entirely. `enabled` is
  // the master switch, same convention as emailNotifications above.
  pushNotifications?: {
    enabled?: boolean;
    missingPicks?: boolean;
    lockerRoomReplies?: boolean;
    weekResults?: boolean;
    autoPickDigest?: boolean;
  };
  // Which panel occupies each of ContentShell's two side columns, last set
  // by the user via the picker in each column's header. Only ever read
  // through resolveSidePanels (src/lib/side-panels.ts), which falls back to
  // a page-appropriate default when unset or no longer valid on the page
  // being viewed (e.g. it pointed at that page's own content).
  sidePanels?: {
    left?: SidePanelType;
    right?: SidePanelType;
  };
  // Same idea as sidePanels above, but for a page migrated to ColumnPage's
  // three fully-equal columns instead of ContentShell's main+2-side split.
  // Kept as a separate field (rather than reshaping sidePanels) so pages
  // not yet migrated are unaffected. Only ever read through
  // resolveColumns (src/lib/side-panels.ts).
  columns?: [SidePanelType, SidePanelType, SidePanelType];
};

// Users table
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  name: text("name").notNull(),
  username: text("username").unique(),
  avatar: text("avatar"),
  // True only for an avatar this app generated itself (a DiceBear identicon
  // persisted so it doesn't depend on a live third-party fetch on every
  // page load) -- never set for a real user upload, so a username change
  // knows it's safe to regenerate this but must never touch an upload.
  avatarIsGenerated: integer("avatar_is_generated", { mode: "boolean" }).default(false),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).default(false),
  // "Paused" for dues not paid, etc: excluded from standings, can't make or
  // change picks, and stops getting pick-reminder/auto-pick emails, but can
  // still log in and view the app read-only. Reactivating restores
  // everything — pick history is never touched.
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  // Tracked manually by admins from the User Management table — buy-ins are
  // collected through LeagueSafe, outside this app, so there's no automatic
  // signal for this. Purely informational (doesn't gate anything a user can
  // do); its only effect is letting admins email just the unpaid players.
  hasPaid: integer("has_paid", { mode: "boolean" }).default(false),
  preferences: text("preferences", { mode: "json" })
    .$type<UserPreferences>()
    .default({}),
  lastPickReminderSentAt: integer("last_pick_reminder_sent_at", {
    mode: "timestamp",
  }),
  // Kept separate from lastPickReminderSentAt (the email gate) so the two
  // channels' once-per-day gates don't fight over the same column -- a user
  // with both enabled should get one email AND one push per day, not
  // whichever channel's cron branch happens to run first.
  lastPickReminderPushSentAt: integer("last_pick_reminder_push_sent_at", {
    mode: "timestamp",
  }),
  lastAutoPickEmailSentAt: integer("last_auto_pick_email_sent_at", {
    mode: "timestamp",
  }),
  // Push equivalent of lastAutoPickEmailSentAt above, kept separate for the
  // same reason as lastPickReminderPushSentAt/lastPickReminderSentAt.
  lastAutoPickPushSentAt: integer("last_auto_pick_push_sent_at", {
    mode: "timestamp",
  }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Sessions for authentication
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// NFL Teams
export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  displayName: text("display_name").notNull(),
  shortDisplayName: text("short_display_name"),
  color: text("color"),
  alternateColor: text("alternate_color"),
  logo: text("logo"),
});

// NFL Games
export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name"),
  date: integer("date", { mode: "timestamp" }).notNull(),
  seasonType: integer("season_type").notNull(), // 1=Preseason, 2=Regular, 3=Postseason
  weekNumber: integer("week_number").notNull(),
  homeTeamId: text("home_team_id")
    .notNull()
    .references(() => teams.id),
  awayTeamId: text("away_team_id")
    .notNull()
    .references(() => teams.id),
  homeTeamScore: integer("home_team_score"),
  awayTeamScore: integer("away_team_score"),
  completed: integer("completed", { mode: "boolean" }).default(false),
  statusName: text("status_name").default("STATUS_SCHEDULED"),
  odds: text("odds"),
  overUnder: real("over_under"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// User picks
export const picks = sqliteTable("picks", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull(),
  teamId: text("team_id").notNull(),
  weekNumber: integer("week_number").notNull(),
  seasonType: integer("season_type").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }),
  isAutoPick: integer("is_auto_pick", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Picks summary for weekly standings and tiebreakers
export const picksSummary = sqliteTable("picks_summary", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  seasonType: integer("season_type").notNull(),
  tiebreakerGameId: text("tiebreaker_game_id"),
  tiebreakerPrediction: integer("tiebreaker_prediction"),
  // Set once, the first time a user submits a tiebreaker prediction for the
  // week, and never overwritten by later edits (see submitTiebreakerAction)
  // — breaks a tie between two different predictions that land the same
  // distance from the actual total, in favor of whoever guessed first.
  tiebreakerSubmittedAt: integer("tiebreaker_submitted_at", { mode: "timestamp" }),
  correctPicksCount: integer("correct_picks_count").default(0),
  totalPicksCount: integer("total_picks_count").default(0),
  tiebreakerActual: integer("tiebreaker_actual"),
  tiebreakerDiff: integer("tiebreaker_diff"),
  rank: integer("rank"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Archived games from past, wiped seasons
export const archivedGames = sqliteTable("archived_games", {
  id: text("id").primaryKey(),
  originalId: text("original_id").notNull(),
  name: text("name").notNull(),
  shortName: text("short_name"),
  date: integer("date", { mode: "timestamp" }).notNull(),
  seasonType: integer("season_type").notNull(),
  weekNumber: integer("week_number").notNull(),
  homeTeamId: text("home_team_id").notNull(),
  awayTeamId: text("away_team_id").notNull(),
  homeTeamScore: integer("home_team_score"),
  awayTeamScore: integer("away_team_score"),
  completed: integer("completed", { mode: "boolean" }).default(false),
  statusName: text("status_name").default("STATUS_SCHEDULED"),
  odds: text("odds"),
  overUnder: real("over_under"),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
  seasonYear: integer("season_year").notNull(),
  archivedAt: integer("archived_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Archived picks from past, wiped seasons
export const archivedPicks = sqliteTable("archived_picks", {
  id: text("id").primaryKey(),
  originalId: text("original_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull(),
  teamId: text("team_id").notNull(),
  weekNumber: integer("week_number").notNull(),
  seasonType: integer("season_type").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
  seasonYear: integer("season_year").notNull(),
  archivedAt: integer("archived_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Archived weekly standings from past, wiped seasons
export const archivedPicksSummary = sqliteTable("archived_picks_summary", {
  id: text("id").primaryKey(),
  originalId: text("original_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  seasonType: integer("season_type").notNull(),
  tiebreakerGameId: text("tiebreaker_game_id"),
  tiebreakerPrediction: integer("tiebreaker_prediction"),
  tiebreakerSubmittedAt: integer("tiebreaker_submitted_at", { mode: "timestamp" }),
  correctPicksCount: integer("correct_picks_count").default(0),
  totalPicksCount: integer("total_picks_count").default(0),
  tiebreakerActual: integer("tiebreaker_actual"),
  tiebreakerDiff: integer("tiebreaker_diff"),
  rank: integer("rank"),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
  seasonYear: integer("season_year").notNull(),
  archivedAt: integer("archived_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const archivedPicksRelations = relations(archivedPicks, ({ one }) => ({
  user: one(users, {
    fields: [archivedPicks.userId],
    references: [users.id],
  }),
}));

export const archivedPicksSummaryRelations = relations(
  archivedPicksSummary,
  ({ one }) => ({
    user: one(users, {
      fields: [archivedPicksSummary.userId],
      references: [users.id],
    }),
  })
);

// User projects (showcase)
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull(),
  thumbnail: text("thumbnail"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  picks: many(picks),
  picksSummaries: many(picksSummary),
  projects: many(projects),
  emailVerificationCodes: many(emailVerificationCodes),
  passwordResetTokens: many(passwordResetTokens),
  pendingEmailChanges: many(pendingEmailChanges),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  homeTeam: one(teams, {
    fields: [games.homeTeamId],
    references: [teams.id],
    relationName: "homeTeam",
  }),
  awayTeam: one(teams, {
    fields: [games.awayTeamId],
    references: [teams.id],
    relationName: "awayTeam",
  }),
  picks: many(picks),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  homeGames: many(games, { relationName: "homeTeam" }),
  awayGames: many(games, { relationName: "awayTeam" }),
  picks: many(picks),
}));

export const picksRelations = relations(picks, ({ one }) => ({
  user: one(users, {
    fields: [picks.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
}));

export const picksSummaryRelations = relations(picksSummary, ({ one }) => ({
  user: one(users, {
    fields: [picksSummary.userId],
    references: [users.id],
  }),
}));

// Email verification codes for registration
export const emailVerificationCodes = sqliteTable("email_verification_codes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Password reset tokens
export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Pending email changes - stores new email awaiting verification
export const pendingEmailChanges = sqliteTable("pending_email_changes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  newEmail: text("new_email").notNull(),
  code: text("code").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Single-row table of site-wide admin-editable settings (e.g. the home page
// message). Always queried/written by the fixed id "singleton".
export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey(),
  homeMessage: text("home_message"),
  // The editable source content for the automated week-results email (see
  // src/lib/week-results-email.ts) -- null until an admin sets one, same
  // "unset means don't send" convention as homeMessage being null meaning
  // no banner. {week_results_*} merge variables (email-merge-vars.ts) get
  // resolved into weekResultsEmailBody at send time.
  weekResultsEmailSubject: text("week_results_email_subject"),
  weekResultsEmailBody: text("week_results_email_body"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// One row per (seasonType, weekNumber) that's already had its automated
// week-results email sent (see src/lib/week-results-email.ts) -- exists
// purely so the 15-minute cron tick that looks for newly-completed weeks
// (picks_summary.rank just went non-null) doesn't re-send every tick.
// Backfilled for every already-complete week as of the migration that
// created this table, so turning the feature on doesn't retroactively
// email old weeks an admin already covered by hand.
export const weekResultsEmails = sqliteTable("week_results_emails", {
  id: text("id").primaryKey(),
  seasonType: integer("season_type").notNull(),
  weekNumber: integer("week_number").notNull(),
  sentAt: integer("sent_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Push equivalent of weekResultsEmails above -- its own table (rather than a
// shared "sent" row) so the two channels' once-per-week gates don't fight
// over the same tracking, same reasoning as
// lastPickReminderPushSentAt/lastPickReminderSentAt on users.
export const weekResultsPushes = sqliteTable("week_results_pushes", {
  id: text("id").primaryKey(),
  seasonType: integer("season_type").notNull(),
  weekNumber: integer("week_number").notNull(),
  sentAt: integer("sent_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Reusable subject/body pairs for the admin "Email Users" form (see
// AdminEmailForm) — an admin picks one from a dropdown to pre-fill the
// composer, which stays fully editable before sending. Purely a starting
// point; sending never references a template's id, so editing or deleting
// one has no effect on emails already sent from it.
export const emailTemplates = sqliteTable("email_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Locker Room chat -- a single, site-wide message board (not per-game).
// Messages are checked against containsProfanity (see src/lib/profanity.ts,
// already used for username validation) before insert, same reject-don't-post
// behavior rather than silently censoring. Live delivery piggybacks on the
// same in-process WebSocket broadcast used for game score/pick updates (see
// src/realtime/locker-room.ts) rather than a separate channel -- the
// broadcast mechanism has nothing game-specific about it.
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Not a Drizzle-level FK reference to itself (no precedent for that in this
  // schema, and every existing ALTER TABLE ADD COLUMN migration here is a
  // plain column add -- see CLAUDE.md on hand-writing migrations). Kept
  // consistent instead: deleteChatMessageAction nulls out any row pointing
  // at a message it deletes, so this never dangles.
  replyToId: text("reply_to_id"),
  body: text("body").notNull(),
  // Set only when the author has edited their own message after sending it
  // -- drives the "(edited)" marker in the UI. Never touched by a delete.
  editedAt: integer("edited_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// One row per (user, browser instance) that has granted push permission and
// subscribed -- a user with the app on a phone and a laptop has two rows,
// and both get every push (see src/lib/push.ts's sendPushToUser). `endpoint`
// is unique because it's the push service's own identifier for that
// subscription; re-subscribing the same device updates the existing row
// (its keys can rotate) rather than creating a duplicate.
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  // Shown on the device-management list in Settings so a user can tell
  // which row is "this phone" vs "that laptop" before removing one.
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  // Set on a 404/410 from the push service (sendPushToUser) -- a row with
  // this set is pruned on its next send attempt rather than kept around
  // retrying a subscription that will never succeed again.
  lastFailedAt: integer("last_failed_at", { mode: "timestamp" }),
});

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

export const emailVerificationCodesRelations = relations(
  emailVerificationCodes,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationCodes.userId],
      references: [users.id],
    }),
  })
);

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  })
);

export const pendingEmailChangesRelations = relations(
  pendingEmailChanges,
  ({ one }) => ({
    user: one(users, {
      fields: [pendingEmailChanges.userId],
      references: [users.id],
    }),
  })
);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Pick = typeof picks.$inferSelect;
export type PicksSummary = typeof picksSummary.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ArchivedGame = typeof archivedGames.$inferSelect;
export type ArchivedPick = typeof archivedPicks.$inferSelect;
export type ArchivedPicksSummary = typeof archivedPicksSummary.$inferSelect;
export type EmailVerificationCode = typeof emailVerificationCodes.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type PendingEmailChange = typeof pendingEmailChanges.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
