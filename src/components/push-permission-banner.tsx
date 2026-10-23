"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { detectPlatform, isStandalone } from "@/lib/platform";
import { subscribePushAction } from "@/app/my/settings/actions";

const DISMISSED_STORAGE_KEY = "pigskinz-dismissed-push-banner";

interface PushPermissionBannerProps {
  vapidPublicKey: string;
}

function urlBase64ToUint8Array(base64Url: string): BufferSource {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)) as BufferSource;
}

/**
 * A dismissible, app-wide nudge to subscribe to push notifications -- shown
 * the first time a signed-in, verified user with no existing push
 * subscription opens the app on a supported browser/platform. Deliberately
 * NOT an automatic Notification.requestPermission() call on load: browsers
 * (Chrome especially) downrank or silently auto-suppress the native prompt
 * on sites that trigger it without a prior user gesture, and a reflexive
 * dismissal of an unprompted dialog permanently blocks the origin from ever
 * asking again. This banner's own Enable button supplies that gesture
 * instead, same flow as the manual "Enable" button on /my/settings
 * (notifications-form.tsx).
 */
export function PushPermissionBanner({ vapidPublicKey }: PushPermissionBannerProps) {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    // iOS only supports push for an installed (home-screen) app -- the
    // banner's Enable button would just fail there, so don't show it until
    // settings' own "Install app first" messaging has been followed.
    if (detectPlatform() === "ios" && !isStandalone()) return;
    // Already decided (granted, handled by hasPushDevice upstream; or
    // denied, which this banner can't do anything about) -- only nudge
    // while the browser hasn't been asked at all yet.
    if (Notification.permission !== "default") return;

    try {
      if (localStorage.getItem(DISMISSED_STORAGE_KEY)) return;
    } catch {
      // Old Safari private browsing throws on access -- fail open (show
      // the banner) rather than let that take down the page.
    }
    setVisible(true);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, "1");
    } catch {
      // Dismissal just won't be remembered for next visit.
    }
    setVisible(false);
  };

  const handleEnable = async () => {
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        // A "denied" result can't be re-prompted automatically, and a
        // reflexive dismiss of the native dialog should stop nagging the
        // same as clicking this banner's own X would.
        dismiss();
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

      toast.success("Push notifications enabled");
      dismiss();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Subscribe failed");
    } finally {
      setSubscribing(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="bg-info/10 border-b border-info/30">
      <div className="max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
        <Bell size={18} className="text-info shrink-0" />
        <p className="flex-1 text-sm text-base-content/80">
          Get notified about missing picks, Locker Room replies, and week results.
        </p>
        <Button onClick={handleEnable} size="sm" loading={subscribing} disabled={subscribing}>
          Enable notifications
        </Button>
        <button onClick={dismiss} className="btn btn-ghost btn-xs btn-circle shrink-0" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
