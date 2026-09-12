import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { Card, CardBody, CardTitle } from "@/components/ui";
import { ProfileForm } from "./profile-form";
import { EmailForm } from "./email-form";
import { UsernameForm } from "./username-form";
import { PasswordForm } from "./password-form";
import { ThemeForm } from "./theme-form";
import { AutoPickForm } from "./auto-pick-form";
import { EmailNotificationsForm } from "./email-notifications-form";
import { InstallAppInstructions } from "./install-app-instructions";
import type { UserPreferences } from "@/db/schema";
import { POOL_NAME } from "@/lib/site-config";

export default async function SettingsPage() {
  const user = await requireAuth().catch(() => null);

  if (!user) {
    redirect("/login");
  }

  const preferences = (user.preferences ?? {}) as UserPreferences;

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

        {/* Email Notification Settings */}
        <Card id="email-notifications" className="scroll-mt-20">
          <CardBody>
            <CardTitle className="mb-4">Email Notifications</CardTitle>
            <EmailNotificationsForm
              isAdmin={!!user.isAdmin}
              initialEnabled={preferences.emailNotifications?.enabled ?? true}
              initialPickReminders={preferences.emailNotifications?.pickReminders ?? true}
              initialAutoPickDigest={preferences.emailNotifications?.autoPickDigest ?? true}
              initialLockerRoomMentions={preferences.emailNotifications?.lockerRoomMentions ?? true}
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
