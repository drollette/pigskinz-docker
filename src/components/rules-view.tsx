import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardBody, CardTitle } from "@/components/ui";
import { ShareButton } from "@/components/share-button";
import { LeagueSafeLink } from "@/components/leaguesafe-link";
import { ListChecks, Calculator, Target, DollarSign } from "lucide-react";
import { LEAGUESAFE_URL, BUYIN_AMOUNT, BUYIN_DEADLINE, PAYOUT_INFO } from "@/lib/site-config";

/** The static "How to Play" content -- offered as one of a column's
 * selectable views, and the only one available to a signed-out visitor. */
export async function RulesView() {
  const user = await getCurrentUser().catch(() => null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        {/* lg+ gets this heading from the column's own dropdown header
            instead (see PanelSelect) -- below that there's no header row at
            all, so this is the only page title a phone gets. */}
        <h1 className="lg:hidden text-3xl font-bold">How to Play</h1>
        <ShareButton />
      </div>

      <Card>
        <CardBody>
          <CardTitle className="flex items-center gap-2 mb-3">
            <ListChecks className="w-5 h-5 text-primary" />
            Picks
          </CardTitle>
          <ul className="space-y-1.5 text-base-content/80 text-sm @sm:text-base list-disc pl-5">
            <li>Pick the straight-up winner of each game — no spread.</li>
            <li>One pick per game.</li>
            <li>Each pick locks at that game&apos;s kickoff.</li>
            <li>
              Auto-pick (in <strong>Settings</strong>) fills in any pick you haven&apos;t made
              before kickoff. A reminder email goes out if you have games left to pick later that
              day.
            </li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardTitle className="flex items-center gap-2 mb-3">
            <Calculator className="w-5 h-5 text-primary" />
            Scoring
          </CardTitle>
          <ul className="space-y-1.5 text-base-content/80 text-sm @sm:text-base list-disc pl-5">
            <li>1 point for every correct pick.</li>
            <li>+2 points to whoever has the most correct picks in a week.</li>
            <li>+1 point to whoever has the second-most correct picks in a week.</li>
            <li>
              +1 point to whoever is closest on the weekly tiebreaker prediction (see below). If
              multiple players tie for closest, everyone at that distance gets the point.
            </li>
            <li>
              Season standings are ranked by total points. Ties are broken by pick accuracy
              (correct picks ÷ graded picks).
            </li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardTitle className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-primary" />
            Tiebreaker
          </CardTitle>
          <ul className="space-y-1.5 text-base-content/80 text-sm @sm:text-base list-disc pl-5">
            <li>Each week&apos;s last game is the tiebreaker game.</li>
            <li>Predict its combined final score (both teams&apos; points added together).</li>
            <li>Every player&apos;s prediction for the week must be a different number.</li>
            <li>
              The weekly 1st/2nd-place bonus above is decided by: most correct picks, then
              closest tiebreaker prediction, then whoever submitted their prediction first.
            </li>
            <li>
              The separate tiebreaker point (+1) goes to whoever is closest to the actual
              combined score, independent of how many picks they got right.
            </li>
          </ul>
        </CardBody>
      </Card>

      {LEAGUESAFE_URL && (
        <Card>
          <CardBody>
            <CardTitle className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-primary" />
              Buy-In &amp; Payouts
            </CardTitle>
            <ul className="space-y-1.5 text-base-content/80 text-sm @sm:text-base list-disc pl-5">
              <li>
                {BUYIN_AMOUNT ? `${BUYIN_AMOUNT} for the season, collected` : "Collected"} through{" "}
                <strong>LeagueSafe</strong> — the top-rated, trusted platform for fantasy sports
                pools since 2008.
              </li>
              <li>
                <LeagueSafeLink />
              </li>
              {BUYIN_DEADLINE && (
                <li>
                  Buy-in is due by <strong>{BUYIN_DEADLINE}</strong>. LeagueSafe does not accept
                  payments after the deadline, so don&apos;t wait until the last minute.
                </li>
              )}
              <li>{PAYOUT_INFO}</li>
              <li>Payouts are based on final season standings (total points).</li>
            </ul>
          </CardBody>
        </Card>
      )}

      <p className="text-center text-base-content/60 text-sm">
        {user ? (
          <>
            Make your picks on the{" "}
            <Link href="/picks" className="link link-primary">
              Picks
            </Link>{" "}
            page.
          </>
        ) : (
          <>
            Ready to join?{" "}
            <Link href="/register" className="link link-primary">
              Sign up
            </Link>{" "}
            to start making picks.
          </>
        )}
      </p>
    </div>
  );
}
