import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import { Navbar } from "@/components/navbar";
import { HomeMessageBanner } from "@/components/home-message-banner";
import { PushPermissionBanner } from "@/components/push-permission-banner";
import { PrizePotBanner } from "@/components/prize-pot-banner";
import { Footer } from "@/components/footer";
import { PWAProvider } from "@/components/pwa-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeScript } from "@/components/theme-script";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentWeekFromDb, getHomeMessage, getPaidPlayerCount, getPrizePoolSettings } from "@/lib/data";
import { getDb, getEnv } from "@/lib/env";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { calculatePrizePot, DEFAULT_BUY_IN_DOLLARS, DEFAULT_PRIZE_SPLIT } from "@/lib/prize-pool";
import { blackOpsOne, radioCanadaBig } from "@/lib/fonts";
import { POOL_NAME } from "@/lib/site-config";
import "./globals.css";

// getCurrentUser() below reads cookies(), which per Next.js docs already
// forces dynamic rendering app-wide since this is the root layout. Making
// it explicit here is a stronger, build-time guarantee than relying on that
// automatic detection: revalidatePath("/", "layout") in auth.ts (see
// createSession/destroySession) turned out not to be enough on its own —
// users were still occasionally served a pre-login render of "/" after
// signing in, which only a real page reload (bypassing every client-side
// and server-side cache) fixed. force-dynamic rules out any full-route
// caching of this layout by Next.js itself, rather than depending on a
// cache entry being correctly invalidated after the fact.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3b82f6",
};

export const metadata: Metadata = {
  title: `${POOL_NAME} - The NFL Pick 'em Football Pool`,
  description: "Make your NFL game predictions and track your picks throughout the season",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: POOL_NAME,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, weekData, homeMessage, paidPlayers, prizePoolSettings] = await Promise.all([
    getCurrentUser().catch(() => null),
    getCurrentWeekFromDb().catch(() => ({
      week: 1,
      seasonType: 2,
      year: new Date().getFullYear(),
    })),
    getHomeMessage().catch(() => null),
    getPaidPlayerCount().catch(() => 0),
    getPrizePoolSettings().catch(() => ({
      enabled: true,
      buyInDollars: DEFAULT_BUY_IN_DOLLARS,
      split: DEFAULT_PRIZE_SPLIT,
    })),
  ]);
  const prizePot = calculatePrizePot(paidPlayers, prizePoolSettings.buyInDollars, prizePoolSettings.split);

  const currentWeek = weekData.week;
  const currentSeasonType = weekData.seasonType;

  // Get user's theme preference, default to system
  const userTheme = user?.preferences?.theme ?? "system";

  // Only worth a round trip for a signed-in, verified user who could
  // actually see the push banner below -- an unverified user isn't yet a
  // real participant (see CLAUDE.md's product model), and this is on every
  // page load app-wide, not just /my/settings.
  let showPushBanner = false;
  if (user && user.emailVerified) {
    const existingDevice = await getDb()
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id))
      .limit(1);
    showPushBanner = existingDevice.length === 0;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript defaultTheme={userTheme} />
      </head>
      <body className={`min-h-screen bg-base-200 ${blackOpsOne.variable} ${radioCanadaBig.variable}`}>
        <ThemeProvider defaultTheme={userTheme}>
          <PWAProvider>
            <Toaster
              position="top-center"
              // Clears the sticky nav (~4rem tall) instead of rendering
              // directly over it, which used to briefly cover the logo.
              containerStyle={{ top: 76 }}
              toastOptions={{
                duration: 4000,
                className: "!bg-base-300 !text-base-content !border !border-base-content/20",
              }}
            />
            <Navbar
              user={user}
              currentWeek={currentWeek}
              currentSeasonType={currentSeasonType}
            />
            {prizePoolSettings.enabled && <PrizePotBanner {...prizePot} />}
            {showPushBanner && <PushPermissionBanner vapidPublicKey={getEnv().VAPID_PUBLIC_KEY} />}
            {homeMessage && <HomeMessageBanner message={homeMessage} />}
            <main className="py-4 pb-12">
              {/* max-w-7xl (1280px) left huge symmetric dead margins on the
                  new equal 3-column pages at very wide desktop monitors
                  (e.g. ~640px per side at 2560px). 96rem (1536px, Tailwind's
                  own 2xl breakpoint) gives those columns real room to
                  breathe without stretching narrower pages (Settings,
                  Admin) unreasonably wide either. */}
              <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                {children}
              </div>
            </main>
            <Footer />
          </PWAProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
