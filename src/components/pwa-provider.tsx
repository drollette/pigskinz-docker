"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        console.log("[PWA] Service worker registered:", registration.scope);

        // Check for updates on registration
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New version available
              setWaitingWorker(newWorker);
              showUpdateToast();
            }
          });
        });

        // Check if there's already a waiting worker
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          showUpdateToast();
        }
      } catch (error) {
        console.error("[PWA] Service worker registration failed:", error);
      }
    };

    // Listen for messages from service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") {
        console.log(`[PWA] Updated to version ${event.data.version}`);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    // Handle controller change (new SW activated)
    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );

    registerSW();

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
    };
  }, []);

  const showUpdateToast = () => {
    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <span className="text-sm">New version available!</span>
          <button
            onClick={() => {
              applyUpdate();
              toast.dismiss(t.id);
            }}
            className="btn btn-primary btn-xs"
          >
            Update
          </button>
        </div>
      ),
      {
        duration: Infinity,
        icon: "🏈",
        id: "sw-update",
      }
    );
  };

  const applyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
  };

  return <>{children}</>;
}
