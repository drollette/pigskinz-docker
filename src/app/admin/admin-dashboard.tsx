"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Users,
  Database,
  Calendar,
  Trophy,
  RefreshCw,
  Shield,
  ShieldOff,
  Trash2,
  AlertTriangle,
  UserCheck,
  UserX,
  DollarSign,
  CircleDollarSign,
} from "lucide-react";
import { triggerSyncNowAction, triggerResetSeasonAction } from "./actions";
import { HomeMessageForm } from "./home-message-form";
import { AdminEmailForm } from "./admin-email-form";
import { EmailTemplateManager, type EmailTemplateData } from "./email-template-manager";
import { MissingPicksPanel } from "./missing-picks-panel";
import { MissingTiebreakerPanel } from "./missing-tiebreaker-panel";
import type { BroadcastRecipientMode } from "@/lib/admin-broadcast";
import type { NextGameMissingPicks, CurrentWeekMissingTiebreaker } from "@/lib/data";

interface Stats {
  users: number;
  teams: number;
  games: number;
  picks: number;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  username: string | null;
  isAdmin: boolean | null;
  isActive: boolean | null;
  hasPaid: boolean | null;
  createdAt: Date | null;
}

interface AdminDashboardProps {
  stats: Stats;
  users: UserData[];
  environmentName: "staging" | "production";
  homeMessage: string;
  nextGameMissingPicks: NextGameMissingPicks | null;
  missingTiebreaker: CurrentWeekMissingTiebreaker | null;
  emailTemplates: EmailTemplateData[];
}

export function AdminDashboard({
  stats,
  users: initialUsers,
  environmentName,
  homeMessage,
  nextGameMissingPicks,
  missingTiebreaker,
  emailTemplates: initialEmailTemplates,
}: AdminDashboardProps) {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [users, setUsers] = useState(initialUsers);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  // Defaults to "selected" with nothing pre-checked, rather than "all" --
  // a mass-send tool shouldn't default to every user, it should require an
  // explicit choice (Missing Picks/Missing Tiebreaker still jump straight
  // into "selected" with their own recipients pre-checked, unaffected).
  const [emailRecipientMode, setEmailRecipientMode] = useState<BroadcastRecipientMode>("selected");
  const [emailSelectedIds, setEmailSelectedIds] = useState<Set<string>>(new Set());
  // Lifted up (rather than owned by EmailTemplateManager) so a template
  // created/edited/deleted there is immediately reflected in AdminEmailForm's
  // "Load template" dropdown, a sibling component, without a page reload.
  const [emailTemplates, setEmailTemplates] = useState(initialEmailTemplates);
  const emailFormRef = useRef<HTMLElement>(null);

  const handleEmailMissingUsers = (userIds: string[]) => {
    setEmailRecipientMode("selected");
    setEmailSelectedIds(new Set(userIds));
    emailFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSync = async (action: string, options?: { seasonType?: number; week?: number }) => {
    setSyncing(action);
    try {
      const response = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...options }),
      });

      const result = await response.json() as { success?: boolean; message?: string; error?: string };

      if (response.ok && result.success) {
        toast.success(result.message || "Sync completed");
      } else {
        toast.error(result.error || result.message || "Sync failed");
      }
    } catch (error) {
      toast.error("Failed to sync");
      console.error(error);
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncNow = async () => {
    setSyncing("sync-now");
    try {
      const result = await triggerSyncNowAction();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Sync complete");
      }
    } catch (error) {
      toast.error("Failed to trigger sync");
      console.error(error);
    } finally {
      setSyncing(null);
    }
  };

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    setUpdatingUser(userId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isAdmin: !currentIsAdmin }),
      });

      const result = await response.json() as { message?: string; error?: string };

      if (response.ok) {
        toast.success(result.message || "User updated");
        setUsers(users.map(u =>
          u.id === userId ? { ...u, isAdmin: !currentIsAdmin } : u
        ));
      } else {
        toast.error(result.error || "Failed to update user");
      }
    } catch (error) {
      toast.error("Failed to update user");
      console.error(error);
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleToggleActive = async (userId: string, currentIsActive: boolean) => {
    setUpdatingUser(userId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isActive: !currentIsActive }),
      });

      const result = await response.json() as { message?: string; error?: string };

      if (response.ok) {
        toast.success(result.message || "User updated");
        setUsers(users.map(u =>
          u.id === userId ? { ...u, isActive: !currentIsActive } : u
        ));
      } else {
        toast.error(result.error || "Failed to update user");
      }
    } catch (error) {
      toast.error("Failed to update user");
      console.error(error);
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleTogglePaid = async (userId: string, currentHasPaid: boolean) => {
    setUpdatingUser(userId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, hasPaid: !currentHasPaid }),
      });

      const result = await response.json() as { message?: string; error?: string };

      if (response.ok) {
        toast.success(result.message || "User updated");
        setUsers(users.map(u =>
          u.id === userId ? { ...u, hasPaid: !currentHasPaid } : u
        ));
      } else {
        toast.error(result.error || "Failed to update user");
      }
    } catch (error) {
      toast.error("Failed to update user");
      console.error(error);
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This cannot be undone.`)) {
      return;
    }

    setUpdatingUser(userId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json() as { message?: string; error?: string };

      if (response.ok) {
        toast.success(result.message || "User deleted");
        setUsers(users.filter(u => u.id !== userId));
      } else {
        toast.error(result.error || "Failed to delete user");
      }
    } catch (error) {
      toast.error("Failed to delete user");
      console.error(error);
    } finally {
      setUpdatingUser(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Database Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users className="w-6 h-6" />} label="Users" value={stats.users} />
          <StatCard icon={<Database className="w-6 h-6" />} label="Teams" value={stats.teams} />
          <StatCard icon={<Calendar className="w-6 h-6" />} label="Games" value={stats.games} />
          <StatCard icon={<Trophy className="w-6 h-6" />} label="Picks" value={stats.picks} />
        </div>
      </section>

      {/* Home Page Message */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Home Page Message</h2>
        <p className="text-sm text-base-content/60 mb-4">
          Plain text shown to everyone near the top of the Home page. Leave blank to hide it.
        </p>
        <HomeMessageForm initialMessage={homeMessage} />
      </section>

      {/* Missing Picks */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Missing Picks</h2>
        <p className="text-sm text-base-content/60 mb-4">
          Active players who haven&apos;t picked the next upcoming game yet.
        </p>
        <MissingPicksPanel data={nextGameMissingPicks} onEmailMissingUsers={handleEmailMissingUsers} />
      </section>

      {/* Missing Tiebreaker */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Missing Tiebreaker</h2>
        <p className="text-sm text-base-content/60 mb-4">
          Active players who haven&apos;t submitted this week&apos;s tiebreaker guess yet.
        </p>
        <MissingTiebreakerPanel data={missingTiebreaker} onEmailMissingUsers={handleEmailMissingUsers} />
      </section>

      {/* Email Users */}
      <section ref={emailFormRef}>
        <h2 className="text-xl font-semibold mb-4">Email Users</h2>
        <p className="text-sm text-base-content/60 mb-4">
          Send an email to an individual user, a group you select, or everyone.
        </p>
        <AdminEmailForm
          users={users}
          templates={emailTemplates}
          recipientMode={emailRecipientMode}
          onRecipientModeChange={setEmailRecipientMode}
          selectedIds={emailSelectedIds}
          onSelectedIdsChange={setEmailSelectedIds}
        />
      </section>

      {/* Email Templates */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Email Templates</h2>
        <p className="text-sm text-base-content/60 mb-4">
          Reusable subject/body pairs that pre-fill the composer above (still fully editable before
          sending).
        </p>
        <EmailTemplateManager templates={emailTemplates} onTemplatesChange={setEmailTemplates} />
      </section>

      {/* Sync Controls */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Data Sync</h2>
        <p className="text-sm text-base-content/60 mb-4">
          Schedule/score syncing fetches directly from ESPN every 15 minutes while a game is in
          progress. Use this to trigger it now.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SyncButton
            label="Sync Now"
            description="Fetch schedules, scores & odds from ESPN"
            action="sync-now"
            syncing={syncing}
            onSync={handleSyncNow}
          />
          <SyncButton
            label="Recalculate Picks"
            description="Recalculate all pick results"
            action="picks"
            syncing={syncing}
            onSync={handleSync}
          />
        </div>
      </section>

      {/* Season Reset */}
      <ResetSeasonSection environmentName={environmentName} />

      {/* User Management */}
      <section>
        <h2 className="text-xl font-semibold mb-4">User Management</h2>
        <div className="relative">
          {/* Hints that the table scrolls horizontally on narrow screens --
              without it, Joined/Actions cut off at the edge read as simply
              missing rather than reachable by scrolling. */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-base-200 to-transparent sm:hidden" />
          <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Username</th>
                <th>Admin</th>
                <th>Status</th>
                <th>Paid</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isActive = user.isActive !== false;
                const hasPaid = !!user.hasPaid;
                return (
                  <tr key={user.id} className={!isActive ? "opacity-60" : undefined}>
                    <td className="font-medium">{user.name}</td>
                    <td className="text-base-content/70">{user.email}</td>
                    <td className="text-base-content/70">{user.username || "-"}</td>
                    <td>
                      {user.isAdmin ? (
                        <span className="badge badge-primary">Admin</span>
                      ) : (
                        <span className="badge badge-outline">User</span>
                      )}
                    </td>
                    <td>
                      {isActive ? (
                        <span className="badge badge-success badge-outline">Active</span>
                      ) : (
                        <span className="badge badge-warning badge-outline">Inactive</span>
                      )}
                    </td>
                    <td>
                      {hasPaid ? (
                        <span className="badge badge-success badge-outline">Paid</span>
                      ) : (
                        <span className="badge badge-ghost">Unpaid</span>
                      )}
                    </td>
                    <td className="text-base-content/70 text-sm">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleAdmin(user.id, !!user.isAdmin)}
                          disabled={updatingUser === user.id}
                          title={user.isAdmin ? "Remove admin" : "Make admin"}
                        >
                          {user.isAdmin ? (
                            <ShieldOff className="w-4 h-4" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(user.id, isActive)}
                          disabled={updatingUser === user.id}
                          title={isActive ? "Mark inactive (dues not paid, etc.)" : "Reactivate user"}
                        >
                          {isActive ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePaid(user.id, hasPaid)}
                          disabled={updatingUser === user.id}
                          title={hasPaid ? "Mark unpaid" : "Mark paid"}
                        >
                          {hasPaid ? (
                            <CircleDollarSign className="w-4 h-4 text-success" />
                          ) : (
                            <DollarSign className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          disabled={updatingUser === user.id}
                          title="Delete user"
                          className="text-error hover:bg-error/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="card bg-base-100 border border-base-300 p-4">
      <div className="flex items-center gap-3">
        <div className="text-primary">{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-base-content/60">{label}</div>
        </div>
      </div>
    </div>
  );
}

function SyncButton({
  label,
  description,
  action,
  syncing,
  onSync,
}: {
  label: string;
  description: string;
  action: string;
  syncing: string | null;
  onSync: (action: string) => void;
}) {
  const isLoading = syncing === action;

  return (
    <button
      onClick={() => onSync(action)}
      disabled={syncing !== null}
      className="card bg-base-100 border border-base-300 p-4 text-left hover:bg-base-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-sm text-base-content/60">{description}</div>
        </div>
        <RefreshCw className={`w-5 h-5 text-primary ${isLoading ? "animate-spin" : ""}`} />
      </div>
    </button>
  );
}

function ResetSeasonSection({
  environmentName,
}: {
  environmentName: "staging" | "production";
}) {
  const [seasonYear, setSeasonYear] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [triggering, setTriggering] = useState(false);

  const expectedConfirm = `ROLLOVER-${environmentName}`;
  const yearValid = seasonYear === "" || /^\d{4}$/.test(seasonYear);
  const confirmValid = confirmText === expectedConfirm;
  const canSubmit = yearValid && confirmValid && !triggering;

  const handleReset = async () => {
    if (!canSubmit) return;

    setTriggering(true);
    try {
      const result = await triggerResetSeasonAction(seasonYear, confirmText);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Season rolled over");
        setConfirmText("");
      }
    } catch (error) {
      toast.error("Failed to trigger season rollover");
      console.error(error);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">Season Rollover</h2>
      <div className="card bg-error/5 border border-error/30 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <p className="text-sm text-base-content/70">
            Archives every game (and its picks/standings) from before the new season — the
            current season&apos;s data, including anything already synced, is left untouched —
            then loads the new season&apos;s full schedule from ESPN on <strong>{environmentName}</strong>.
            Teams and user accounts are never touched. Meant to run once a year, around NFL
            schedule release. Fetches every week of the new season from ESPN before writing
            anything, so this can take a little while.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">New season year (blank = auto-detect from today)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Auto-detect"
              value={seasonYear}
              onChange={(e) => setSeasonYear(e.target.value.trim())}
              disabled={triggering}
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">
              Type <code className="text-xs">{expectedConfirm}</code> to confirm
            </label>
            <input
              type="text"
              placeholder={expectedConfirm}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={triggering}
              className="input w-full"
            />
          </div>
        </div>

        <Button variant="error" onClick={handleReset} disabled={!canSubmit} loading={triggering}>
          Archive Past Season &amp; Load New Schedule
        </Button>
      </div>
    </section>
  );
}
