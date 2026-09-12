"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { LEAGUESAFE_URL } from "@/lib/site-config";

// This app runs as an installed (display: standalone) PWA, and on iOS —
// plus many Android setups — a standalone PWA opens ALL external links,
// even target="_blank" ones, inside its own restricted in-app webview
// rather than the real system browser. That webview fails LeagueSafe's
// Cloudflare bot-check, which the real browser passes fine. There's no
// reliable way to force a standalone PWA to hand off to the system
// browser, so the practical fix is making it trivial to copy the link
// and open it there instead.
export function LeagueSafeLink() {
  const [copied, setCopied] = useState(false);

  // No buy-in link configured for this deployment (NEXT_PUBLIC_LEAGUESAFE_URL) --
  // most self-hosted pools aren't collecting real money, so this section
  // just doesn't render rather than shipping a placeholder link.
  if (!LEAGUESAFE_URL) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(LEAGUESAFE_URL);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 flex-wrap">
        <a
          href={LEAGUESAFE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="link link-primary font-medium inline-flex items-center gap-1"
        >
          Pay your buy-in on LeagueSafe
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="btn btn-ghost btn-xs gap-1 text-base-content/60"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="text-xs text-base-content/50">
        If LeagueSafe shows a verification error, copy the link and open it in your phone&apos;s
        browser instead of tapping it directly — this happens in the installed app on some
        phones.
      </p>
    </div>
  );
}
