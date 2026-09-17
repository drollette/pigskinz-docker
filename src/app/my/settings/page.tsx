import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getDb, getEnv } from "@/lib/env";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardBody, CardTitle } from "@/components/ui";
import { ProfileForm } from "./profile-form";
import { EmailForm } from "./email-form";
import { UsernameForm } from "./username-form";
import { PasswordForm } from "./password-form";
import { ThemeForm } from "./theme-form";
import { AutoPickForm } from "./auto-pick-form";
import { NotificationsForm } from "./notifications-form";
import { InstallAppInstructions } from "./install-app-instructions";
import type { UserPreferences } from "@/db/schema";
import { POOL_NAME } from "@/lib/site-config";

export default async function SettingsPage() {
  const user = await requireAuth().catch(() => null);

  if (!user) {
    redirect("/login");
  }

  const preferences = (user.preferences ?? {}) as UserPreferences;

  const db = getDb();
  const devices = await db
    .select({
      id: pushSubscriptions.id,
      userAgent: pushSubscriptions.userAgent,
      createdAt: pushSubscriptions.createdAt,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id));

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Profile Settings */}
        <Card>
          <CardBody>
            <CardTitle className="mb-4">Profile</CardTitle>
            <ProfileForm user={user} />
          </CardBody>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardBody>
            <CardTitle className="mb-4">Appearance</CardTitle>
            <p className="text-base-content/60 text-sm mb-4">
              Customize how {POOL_NAME} looks on your device
            </p>
            <ThemeForm initialTheme={preferences.theme ?? "system"} />
          </CardBody>
        </Card>

        {/* Install App */}
        <Card>
          <CardBody>
            <CardTitle className="mb-4">Install App</CardTitle>
            <p className="text-base-content/60 text-sm mb-4">
              Add {POOL_NAME} to your home screen for quick access, like a regular app.
            </p>
            <InstallAppInstructions />
          </CardBody>
        </Card>

        {/* Auto-Pick Settings */}
        <Card>
          <CardBody>
            <CardTitle className="mb-4">Auto-Pick</CardTitle>
            <AutoPickForm
              initialEnabled={preferences.autoPick?.enabled ?? false}
              initialStrategy={preferences.autoPick?.strategy ?? "random"}
            />
          </CardBody>
        </Card>

        {/* Notification Settings */}
        {/* id kept as "email-notifications" -- already-sent emails link here
            (src/lib/email.ts's footer) and that link can't be updated after
            the fact. */}
        <Card id="email-notifications" className="scroll-mt-20">
          <CardBody>
            <CardTitle className="mb-4">Notifications</CardTitle>
            <NotificationsForm
              isAdmin={!!user.isAdmin}
              vapidPublicKey={getEnv().VAPID_PUBLIC_KEY}
              initialEmail={{
                enabled: preferences.emailNotifications?.enabled ?? true,
                pickReminders: preferences.emailNotifications?.pickReminders ?? true,
                autoPickDigest: preferences.emailNotifications?.autoPickDigest ?? true,
                lockerRoomMentions: preferences.emailNotifications?.lockerRoomMentions ?? true,
                weekResults: preferences.emailNotifications?.weekResults ?? true,
              }}
              initialPush={{
                enabled: preferences.pushNotifications?.enabled ?? true,
                missingPicks: preferences.pushNotifications?.missingPicks ?? true,
                lockerRoomReplies: preferences.pushNotifications?.lockerRoomReplies ?? true,
                weekResults: preferences.pushNotifications?.weekResults ?? true,
                autoPickDigest: preferences.pushNotifications?.autoPickDigest ?? true,
              }}
              initialDevices={devices.map((d) => ({
                id: d.id,
                userAgent: d.userAgent,
                createdAt: d.createdAt ? d.createdAt.toISOString() : null,
              }))}
            />
          </CardBody>
        </Card>

        {/* Account Settings */}
        <Card>
          <CardBody>
            <CardTitle className="mb-4">Account</CardTitle>
            <div className="space-y-6">
              <EmailForm user={user} />
              <div className="divider" />
              <UsernameForm user={user} />
            </div>
          </CardBody>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardBody>
            <CardTitle className="mb-4">Security</CardTitle>
            <PasswordForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
