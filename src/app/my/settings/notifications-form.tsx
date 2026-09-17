"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectPlatform, isStandalone } from "@/lib/platform";
import { POOL_NAME } from "@/lib/site-config";
import {
  updateEmailNotificationsAction,
  updatePushNotificationsAction,
  subscribePushAction,
  unsubscribePushAction,
} from "./actions";

interface EmailPrefs {
  enabled: boolean;
  pickReminders: boolean;
  autoPickDigest: boolean;
  lockerRoomMentions: boolean;
  weekResults: boolean;
}

interface PushPrefs {
  enabled: boolean;
  missingPicks: boolean;
  lockerRoomReplies: boolean;
  weekResults: boolean;
  autoPickDigest: boolean;
}

interface PushDevice {
  id: string;
  userAgent: string | null;
  createdAt: string | null;
}

interface NotificationsFormProps {
  isAdmin: boolean;
  vapidPublicKey: string;
  initialEmail: EmailPrefs;
  initialPush: PushPrefs;
  initialDevices: PushDevice[];
}

function urlBase64ToUint8Array(base64Url: string): BufferSource {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)) as BufferSource;
}

type PushStatus = "checking" | "unsupported" | "needs-install" | "denied" | "not-subscribed" | "subscribed";

export function NotificationsForm({
  isAdmin,
  vapidPublicKey,
  initialEmail,
  initialPush,
  initialDevices,
}: NotificationsFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [push, setPush] = useState(initialPush);
  const [devices, setDevices] = useState(initialDevices);
  const [emailPending, setEmailPending] = useState(false);
  const [pushPending, setPushPending] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [status, setStatus] = useState<PushStatus>("checking");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (detectPlatform() === "ios" && !isStandalone()) {
      setStatus("needs-install");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    setStatus(devices.length > 0 ? "subscribed" : "not-subscribed");
  }, [devices.length]);

  const saveEmail = (next: EmailPrefs) => {
    setEmailPending(true);
    const previous = email;
    setEmail(next);
    updateEmailNotificationsAction(
      next.enabled,
      next.pickReminders,
      next.autoPickDigest,
      next.lockerRoomMentions,
      next.weekResults
    )
      .then((result) => {
        if ("error" in result) {
          toast.error(result.error);
          setEmail(previous);
        }
      })
      .finally(() => setEmailPending(false));
  };

  const savePush = (next: PushPrefs) => {
    setPushPending(true);
    const previous = push;
    setPush(next);
    updatePushNotificationsAction(
      next.enabled,
      next.missingPicks,
      next.lockerRoomReplies,
      next.weekResults,
      next.autoPickDigest
    )
      .then((result) => {
        if ("error" in result) {
          toast.error(result.error);
          setPush(previous);
        }
      })
      .finally(() => setPushPending(false));
  };

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "not-subscribed");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Subscription missing required fields");
      }

      const result = await subscribePushAction({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      const newDevice: PushDevice = {
        id: result.id,
        userAgent: navigator.userAgent,
        createdAt: new Date().toISOString(),
      };
      setDevices((d) => [...d.filter((existing) => existing.userAgent !== newDevice.userAgent), newDevice]);
      setStatus("subscribed");
      toast.success("Push notifications enabled");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Subscribe failed");
    } finally {
      setSubscribing(false);
    }
  };

  const handleRemoveDevice = async (id: string) => {
    const result = await unsubscribePushAction(id);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setDevices((d) => d.filter((device) => device.id !== id));
    toast.success("Device removed");
  };

  const pushEnabled = status === "subscribed";
  const rows: {
    label: string;
    emailKey: keyof EmailPrefs | null;
    pushKey: keyof PushPrefs;
    description: string;
  }[] = [
    {
      label: "Pick reminders",
      emailKey: "pickReminders",
      pushKey: "missingPicks",
      description: "A reminder if you have games left to pick later that day.",
    },
    {
      label: "Locker Room replies & mentions",
      emailKey: isAdmin ? "lockerRoomMentions" : null,
      pushKey: "lockerRoomReplies",
      description: isAdmin
        ? "Email: when someone @mentions you (or @admin) or replies to your message. Push: when anyone replies to or @mentions you."
        : "When someone replies to your message or @mentions you in the Locker Room.",
    },
    {
      label: "Week results",
      emailKey: "weekResults",
      pushKey: "weekResults",
      description: "Once all of a week's games are final.",
    },
    {
      label: "Auto-pick summary",
      emailKey: "autoPickDigest",
      pushKey: "autoPickDigest",
      description: "When auto-pick fills in a game you missed.",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center justify-between gap-2 cursor-pointer">
          <span className="font-medium text-sm">Email</span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm shrink-0"
            checked={email.enabled}
            onChange={(e) => saveEmail({ ...email, enabled: e.target.checked })}
            disabled={emailPending}
          />
        </label>

        {/* The actionable control lives right here, in place of a disabled
            toggle -- a greyed-out switch with no explanation (the previous
            design) reads as broken rather than as "do something first,"
            and the real "Enable" button sitting below the whole table was
            easy to miss entirely (a real report: a user scrolled past it
            twice without seeing it). */}
        {status === "subscribed" ? (
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="font-medium text-sm">Push</span>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm shrink-0"
              checked={push.enabled}
              onChange={(e) => savePush({ ...push, enabled: e.target.checked })}
              disabled={pushPending}
            />
          </label>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm">Push</span>
            {status === "checking" && <span className="text-xs text-base-content/40">&hellip;</span>}
            {status === "unsupported" && <span className="text-xs text-base-content/50">Not supported</span>}
            {status === "needs-install" && <span className="text-xs text-base-content/50">Install app first</span>}
            {status === "denied" && <span className="text-xs text-base-content/50">Blocked in browser</span>}
            {status === "not-subscribed" && (
              <Button onClick={handleSubscribe} size="sm" loading={subscribing} disabled={subscribing}>
                Enable
              </Button>
            )}
          </div>
        )}
      </div>

      {status === "needs-install" && (
        <p className="text-xs text-base-content/50 -mt-2">
          Install {POOL_NAME} to your home screen first (see &quot;Install App&quot; above) &mdash; iOS only supports
          push notifications for the installed app.
        </p>
      )}

      {status === "denied" && (
        <p className="text-xs text-base-content/50 -mt-2">
          Notifications are blocked for this site in your browser. Re-enable them in your browser&apos;s site
          settings, then reload this page.
        </p>
      )}

      <div className="divider my-1" />

      <div className="overflow-x-auto">
        <table className="table table-fixed">
          <thead>
            <tr>
              <th>Notification</th>
              <th className="text-center w-20">Email</th>
              <th className="text-center w-20">Push</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>
                  <div className="font-medium">{row.label}</div>
                  <div className="text-xs text-base-content/60">{row.description}</div>
                </td>
                <td className="text-center">
                  {row.emailKey ? (
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm"
                      checked={email[row.emailKey]}
                      onChange={(e) => saveEmail({ ...email, [row.emailKey as keyof EmailPrefs]: e.target.checked })}
                      disabled={emailPending || !email.enabled}
                    />
                  ) : (
                    <span className="text-base-content/30">&mdash;</span>
                  )}
                </td>
                <td className="text-center">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={push[row.pushKey]}
                    onChange={(e) => savePush({ ...push, [row.pushKey]: e.target.checked })}
                    disabled={pushPending || !pushEnabled || !push.enabled}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {status === "subscribed" && (
        <>
        <div className="divider my-1" />
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">Devices</div>
            {devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-base-content/70">{device.userAgent ?? "Unknown device"}</span>
                <button
                  onClick={() => handleRemoveDevice(device.id)}
                  className="btn btn-ghost btn-xs text-error"
                  aria-label="Remove this device"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <Button onClick={handleSubscribe} variant="ghost" size="sm" loading={subscribing} disabled={subscribing}>
            Subscribe this device too
          </Button>
        </div>
        </>
      )}
    </div>
  );
}
