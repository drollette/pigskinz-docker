import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamStandingRow } from "@/lib/nfl-standings";
import type { Division } from "@/lib/nfl-divisions";

interface DivisionStandingsTableProps {
  division: Division;
  teams: TeamStandingRow[];
}

function logoUrl(team: TeamStandingRow) {
  return team.logo || `https://a.espncdn.com/i/teamlogos/nfl/500/${team.abbreviation.toLowerCase()}.png`;
}

export function DivisionStandingsTable({ division, teams }: DivisionStandingsTableProps) {
  return (
    <div className="@container card bg-base-100 shadow-xl">
      <div className="card-body p-4">
        <h3 className="card-title text-base mb-2">{division}</h3>
        <div className="relative">
          {/* Hints that the table scrolls horizontally -- these 11 columns
              essentially always overflow the card at the widths this
              renders at (a single column of ColumnPage's 3-up grid), so a
              same-color-to-transparent fade alone isn't enough: it's
              invisible against a same-colored, non-zebra-striped table. The
              chevron badge is the actual affordance; the fade just softens
              its backdrop. Shown at every width rather than only narrow
              ones, since a genuinely wide render (unconstrained by a
              column) is not a case this page currently has. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-10 flex items-center justify-end bg-gradient-to-l from-base-100 via-base-100/90 to-transparent"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-base-300 text-base-content/70 mr-1">
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-xs @sm:table-sm">
              <thead>
                <tr className="bg-base-200">
                  <th className="text-left">Team</th>
                  <th className="text-center">W</th>
                  <th className="text-center">L</th>
                  <th className="text-center">T</th>
                  <th className="text-center">PCT</th>
                  <th className="text-center">DIV</th>
                  <th className="text-center">CONF</th>
                  <th className="text-center">PF</th>
                  <th className="text-center">PA</th>
                  <th className="text-center">DIFF</th>
                  <th className="text-center">STRK</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, index) => (
                  <tr
                    key={team.teamId}
                    className={cn(index === 0 && "bg-primary/10 font-semibold")}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoUrl(team)}
                          alt=""
                          className="w-5 h-5 object-contain shrink-0"
                          loading="lazy"
                        />
                        <span className="whitespace-nowrap">{team.abbreviation}</span>
                      </div>
                    </td>
                    <td className="text-center">{team.wins}</td>
                    <td className="text-center">{team.losses}</td>
                    <td className="text-center">{team.ties}</td>
                    <td className="text-center tabular-nums">{team.winPct.toFixed(3).replace(/^0/, "")}</td>
                    <td className="text-center whitespace-nowrap">{team.divisionRecord}</td>
                    <td className="text-center whitespace-nowrap">{team.conferenceRecord}</td>
                    <td className="text-center">{team.pointsFor}</td>
                    <td className="text-center">{team.pointsAgainst}</td>
                    <td
                      className={cn(
                        "text-center",
                        team.pointDifferential > 0 && "text-success",
                        team.pointDifferential < 0 && "text-error"
                      )}
                    >
                      {team.pointDifferential > 0 ? "+" : ""}
                      {team.pointDifferential}
                    </td>
                    <td className="text-center whitespace-nowrap">{team.streak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
