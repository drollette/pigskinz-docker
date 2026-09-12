import toast from "react-hot-toast";
import { SITE_URL, POOL_NAME } from "./site-config";

const SHARE_TITLE = `${POOL_NAME} - The NFL Pick 'em Football Pool`;
const SHARE_TEXT = `Join our NFL pick 'em pool on ${POOL_NAME}!`;

/**
 * Uses the native share sheet when available (mobile browsers), otherwise
 * falls back to copying the link and toasting confirmation.
 */
export async function shareApp(): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SITE_URL });
    } catch {
      // User cancelled the share sheet — not an error.
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(SITE_URL);
    toast.success("Link copied!");
  } catch {
    toast.error("Couldn't copy link");
  }
}
