import { getCurrentUser } from "@/lib/auth";
import { getNFLStandings } from "@/lib/data";
import { ConferenceStandings } from "@/components/conference-standings";

/** NFL conference/division standings + playoff seeds -- offered as one of
 * a column's selectable views. */
export async function NflStandingsView() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;

  const { standings, playoffSeeds } = await getNFLStandings();

  return (
    <div className="space-y-6">
      {/* lg+ gets this heading from the column's own dropdown header instead
          (see PanelSelect) -- below that there's no header row at all, so
          this is the only page title a phone gets. */}
      <h1 className="lg:hidden text-2xl font-bold text-base-content">NFL Standings</h1>
      <ConferenceStandings standings={standings} playoffSeeds={playoffSeeds} />
    </div>
  );
}
