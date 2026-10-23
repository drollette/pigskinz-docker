"use client";

import { useEffect } from "react";

// Registers the service worker and reloads the page once a new version
// actually takes over (sw.js's install handler skips waiting on its own --
// no user confirmation step; a "click to update" toast turned out to be
// unreliable across multiple open tabs/PWA instances, where the update
// could land on one client while the toast kept showing, stale, on
// another).
export function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("[PWA] Service worker registered:", registration.scope);
      })
      .catch((error) => {
        console.error("[PWA] Service worker registration failed:", error);
      });

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return <>{children}</>;
}
