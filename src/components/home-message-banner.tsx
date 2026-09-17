"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISSED_STORAGE_KEY = "pigskinz-dismissed-home-message";

interface HomeMessageBannerProps {
  message: string;
}

/**
 * The admin-authored announcement (site_settings.home_message), shown
 * app-wide directly below the nav bar rather than scoped to one column's
 * Pool Standings view -- a user with a different view picked for every
 * column would otherwise never see it at all. Dismissal is keyed off the
 * message's own content, not a plain boolean, so editing the message in
 * the admin dashboard re-surfaces it for everyone who already dismissed
 * the previous one.
 */
export function HomeMessageBanner({ message }: HomeMessageBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed: string | null = null;
    try {
      dismissed = localStorage.getItem(DISMISSED_STORAGE_KEY);
    } catch {
      // Storage inaccessible (private browsing, blocked site data) -- show
      // the banner; dismissal just won't persist across reloads.
    }
    setVisible(dismissed !== message);
  }, [message]);

  if (!visible) return null;

  return (
    <div className="bg-info/10 border-b border-info/30">
      <div className="max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-start gap-3">
        <div
          className="prose prose-sm max-w-none flex-1 text-base-content/80 [&_p]:my-1"
          dangerouslySetInnerHTML={{ __html: message }}
        />
        <button
          onClick={() => {
            try {
              localStorage.setItem(DISMISSED_STORAGE_KEY, message);
            } catch {
              // Storage inaccessible -- dismissal won't persist, but the
              // click should still close the banner for this render.
            }
            setVisible(false);
          }}
          className="btn btn-ghost btn-xs btn-circle shrink-0"
          aria-label="Dismiss message"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
