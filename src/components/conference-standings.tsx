"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { DivisionStandingsTable } from "@/components/division-standings-table";
import { CONFERENCES, DIVISIONS, type Conference } from "@/lib/nfl-divisions";
import type { StandingsByDivision, PlayoffSeed } from "@/lib/nfl-standings";

interface ConferenceStandingsProps {
  standings: StandingsByDivision;
  playoffSeeds: Record<Conference, PlayoffSeed[]>;
}

// Same ESPN CDN pattern used for team logos (see getTeamLogoUrl in lib/utils) —
// ESPN also serves the AFC/NFC shield logos as "teamlogos" under these
// conference abbreviations.
function conferenceLogoUrl(conference: Conference) {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${conference.toLowerCase()}.png`;
}

export function ConferenceStandings({ standings, playoffSeeds }: ConferenceStandingsProps) {
  const [conference, setConference] = useState<Conference>("AFC");

  return (
    <div className="@container space-y-6">
      <div role="tablist" className="tabs tabs-boxed w-fit">
        {CONFERENCES.map((c) => (
          <button
            key={c}
            role="tab"
            type="button"
            onClick={() => setConference(c)}
            className={cn("tab gap-2", conference === c && "tab-active")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={conferenceLogoUrl(c)} alt="" className="w-5 h-5 object-contain" />
            {c}
          </button>
        ))}
      </div>

      <PlayoffPicture seeds={playoffSeeds[conference]} />

      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-4">
        {DIVISIONS.map((division) => (
          <DivisionStandingsTable
            key={division}
            division={division}
            teams={standings[conference][division]}
          />
        ))}
      </div>
    </div>
  );
}

function PlayoffPicture({ seeds }: { seeds: PlayoffSeed[] }) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body p-4">
        <h3 className="card-title text-base mb-2">Playoff Picture</h3>
        <ul className="space-y-1">
          {seeds.map(({ seed, team, clinchType }) => (
            <li key={team.teamId} className="flex items-center gap-3 py-1">
              <span className="font-mono w-5 text-center text-base-content/60">{seed}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={team.logo || `https://a.espncdn.com/i/teamlogos/nfl/500/${team.abbreviation.toLowerCase()}.png`}
                alt=""
                className="w-5 h-5 object-contain shrink-0"
                loading="lazy"
              />
              <span className="flex-1">{team.displayName}</span>
              <span className="text-base-content/60 tabular-nums">
                {team.wins}-{team.losses}
                {team.ties > 0 ? `-${team.ties}` : ""}
              </span>
              {clinchType === "division" && (
                <span className="badge badge-primary badge-sm">Division</span>
              )}
              {clinchType === "wildcard" && (
                <span className="badge badge-ghost badge-sm">Wild Card</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
