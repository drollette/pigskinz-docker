"use client";

import { useEffect, useState } from "react";
import { Share, MoreVertical, Download, CheckCircle2 } from "lucide-react";

type Platform = "ios" | "android" | "desktop" | "unknown";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports as "Mac" in the UA string but is still a touch device.
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Chrome|Edg/.test(ua)) return "desktop";
  return "unknown";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own (non-standard) flag for an installed home-screen app.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallAppInstructions() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
  }, []);

  // Avoid a flash of the wrong platform's instructions during hydration.
  if (platform === null) return null;

  if (installed) {
    return (
      <div className="flex items-center gap-2 text-success text-sm">
        <CheckCircle2 size={18} />
        You&apos;re using the installed app on this device.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(platform === "ios" || platform === "unknown") && (
        <div>
          <div className="flex items-center gap-2 font-medium mb-1">
            <Share size={16} />
            iPhone / iPad (Safari)
          </div>
          <ol className="list-decimal list-inside text-sm text-base-content/70 space-y-0.5">
            <li>Tap the Share icon in Safari&apos;s toolbar</li>
            <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
            <li>Tap &quot;Add&quot; to confirm</li>
          </ol>
        </div>
      )}

      {(platform === "android" || platform === "unknown") && (
        <div>
          <div className="flex items-center gap-2 font-medium mb-1">
            <MoreVertical size={16} />
            Android (Chrome)
          </div>
          <ol className="list-decimal list-inside text-sm text-base-content/70 space-y-0.5">
            <li>Tap the menu (⋮) in the top right</li>
            <li>Tap &quot;Install app&quot; or &quot;Add to Home screen&quot;</li>
            <li>Confirm to add it to your home screen</li>
          </ol>
        </div>
      )}

      {(platform === "desktop" || platform === "unknown") && (
        <div>
          <div className="flex items-center gap-2 font-medium mb-1">
            <Download size={16} />
            Desktop (Chrome / Edge)
          </div>
          <ol className="list-decimal list-inside text-sm text-base-content/70 space-y-0.5">
            <li>Click the install icon in the address bar (or the browser menu)</li>
            <li>Click &quot;Install&quot;</li>
          </ol>
        </div>
      )}
    </div>
  );
}
