"use client";

export type Platform = "ios" | "android" | "desktop" | "unknown";

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports as "Mac" in the UA string but is still a touch device.
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Chrome|Edg/.test(ua)) return "desktop";
  return "unknown";
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own (non-standard) flag for an installed home-screen app.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
