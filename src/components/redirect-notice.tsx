"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import toast from "react-hot-toast";

/** Fires a toast once for a server-side redirect that landed here because
 * of a denied action (e.g. a non-admin hitting /admin), then strips the
 * query param so refreshing the page doesn't re-show it. */
export function RedirectNotice({ message }: { message: string | null }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!message) return;
    toast.error(message);
    router.replace(pathname);
    // Only ever run once, when a message is first present on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
