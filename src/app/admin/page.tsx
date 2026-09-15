import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getEnv } from "@/lib/env";
import { users, teams, games, picks, emailTemplates } from "@/db/schema";
import { count, desc } from "drizzle-orm";
import {
  getHomeMessage,
  getWeekResultsEmailTemplate,
  getNextGameMissingPicks,
  getCurrentWeekMissingTiebreaker,
} from "@/lib/data";
import { AdminDashboard } from "./admin-dashboard";

export default async function AdminPage() {
  const user = await getCurrentUser().catch(() => null);

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin) {
    redirect("/?notice=admin-required");
  }

  // Fetch stats
  const db = getDb();

  const [
    userCount,
    teamCount,
    gameCount,
    pickCount,
    allUsers,
    homeMessage,
    weekResultsEmailTemplate,
    nextGameMissingPicks,
    missingTiebreaker,
    templates,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(teams),
    db.select({ count: count() }).from(games),
    db.select({ count: count() }).from(picks),
    db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      username: users.username,
      isAdmin: users.isAdmin,
      isActive: users.isActive,
      hasPaid: users.hasPaid,
      createdAt: users.createdAt,
    }).from(users),
    getHomeMessage(),
    getWeekResultsEmailTemplate(),
    getNextGameMissingPicks(),
    getCurrentWeekMissingTiebreaker(),
    db
      .select({
        id: emailTemplates.id,
        name: emailTemplates.name,
        subject: emailTemplates.subject,
        bodyHtml: emailTemplates.bodyHtml,
      })
      .from(emailTemplates)
      .orderBy(desc(emailTemplates.updatedAt)),
  ]);

  const stats = {
    users: userCount[0]?.count ?? 0,
    teams: teamCount[0]?.count ?? 0,
    games: gameCount[0]?.count ?? 0,
    picks: pickCount[0]?.count ?? 0,
  };

  const environmentName = getEnv().ENVIRONMENT_NAME;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-base-content">Admin Dashboard</h1>
      <AdminDashboard
        stats={stats}
        users={allUsers}
        environmentName={environmentName}
        homeMessage={homeMessage ?? ""}
        weekResultsEmailSubject={weekResultsEmailTemplate?.subject ?? ""}
        weekResultsEmailBody={weekResultsEmailTemplate?.body ?? ""}
        nextGameMissingPicks={nextGameMissingPicks}
        missingTiebreaker={missingTiebreaker}
        emailTemplates={templates}
      />
    </div>
  );
}
