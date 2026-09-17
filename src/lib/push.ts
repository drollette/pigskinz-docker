// Relative imports throughout, not the "@/" tsconfig alias -- reachable from
// src/cron/index.ts, which tsx runs outside Next's bundler (see CLAUDE.md's
// "Path aliases" note), as well as from ordinary Next.js Server Actions.
// @block65/webcrypto-web-push is built on the standard Web Crypto API
// rather than Node's `crypto` module, which Node 22 also exposes globally
// (the same reason src/lib/utils.ts's hashPassword needs no extra package),
// so this runs identically here as it did in the Cloudflare original.
import { eq } from "drizzle-orm";
import {
  buildPushPayload,
  type PushSubscription as WebPushSubscription,
  type VapidKeys,
} from "@block65/webcrypto-web-push";
import { pushSubscriptions } from "../db/schema";
import type { Database } from "../db";
import type { AppEnv } from "./env";
import { EMAIL_FROM_ADDRESS } from "./site-config";

export interface PushNotificationPayload {
  title: string;
  body: string;
  /** Where notificationclick (public/sw.js) should send the user. */
  url: string;
}

class PushSendError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

/**
 * Sends one Web Push message to one subscription. Throws PushSendError
 * (carrying the push service's status code) if it's rejected.
 */
export async function sendPushNotification(
  env: AppEnv,
  subscription: WebPushSubscription,
  payload: PushNotificationPayload
): Promise<void> {
  const vapid: VapidKeys = {
    subject: `mailto:${EMAIL_FROM_ADDRESS}`,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  const request = await buildPushPayload(
    { data: JSON.stringify(payload), options: { ttl: 60 } },
    subscription,
    vapid
  );

  const res = await fetch(subscription.endpoint, request);
  if (!res.ok) {
    throw new PushSendError(`Push service rejected notification: ${res.status} ${await res.text()}`, res.status);
  }
}

/**
 * Sends one push to every device a user has subscribed (push_subscriptions
 * rows), independently -- one device's failure never blocks the others,
 * same per-recipient try/catch every email sender in this repo already
 * uses. A 404/410 means the push service has permanently discarded that
 * subscription (browser data cleared, app uninstalled, permission
 * revoked), so that row is deleted immediately rather than retried on
 * every future send.
 */
export async function sendPushToUser(
  db: Database,
  env: AppEnv,
  userId: string,
  payload: PushNotificationPayload
): Promise<void> {
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));

  for (const sub of subs) {
    try {
      await sendPushNotification(
        env,
        {
          endpoint: sub.endpoint,
          expirationTime: null,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
    } catch (error) {
      if (error instanceof PushSendError && (error.status === 404 || error.status === 410)) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      } else {
        console.error(`Failed to send push to subscription ${sub.id} (user ${userId}):`, error);
      }
    }
  }
}
