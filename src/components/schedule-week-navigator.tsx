"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";

interface Team {
  id: string;
  name: string;
  abbreviation: string;
  logo: string | null;
}

interface ScheduleWeekNavigatorProps {
  currentWeek: number;
  currentSeasonType: number;
  teams: Team[];
  selectedTeamId: string | null;
}

export function ScheduleWeekNavigator({
  currentWeek,
  currentSeasonType,
  teams,
  selectedTeamId,
}: ScheduleWeekNavigatorProps) {
  const router = useRouter();

  const getMaxWeeks = (seasonType: number) => {
    switch (seasonType) {
      case 1:
        return 4; // Preseason
      case 2:
        return 18; // Regular season
      case 3:
        return 4; // Postseason
      default:
        return 18;
    }
  };

  const buildUrl = (seasonType: number, week: number, teamId: string | null) => {
    const base = `/schedule/${seasonType}/${week}`;
    return teamId ? `${base}?team=${teamId}` : base;
  };

  const navigateWeek = (direction: "prev" | "next") => {
    let newWeek = currentWeek;
    let newSeasonType = currentSeasonType;

    if (direction === "next") {
      if (currentWeek >= getMaxWeeks(currentSeasonType)) {
        if (currentSeasonType === 1) {
          newSeasonType = 2;
          newWeek = 1;
        } else if (currentSeasonType === 2) {
          newSeasonType = 3;
          newWeek = 1;
        } else {
          newSeasonType = 1;
          newWeek = 1;
        }
      } else {
        newWeek = currentWeek + 1;
      }
    } else {
      if (currentWeek === 1) {
        if (currentSeasonType === 1) {
          newSeasonType = 3;
          newWeek = getMaxWeeks(3);
        } else if (currentSeasonType === 2) {
          newSeasonType = 1;
          newWeek = getMaxWeeks(1);
        } else {
          newSeasonType = 2;
          newWeek = getMaxWeeks(2);
        }
      } else {
        newWeek = currentWeek - 1;
      }
    }

    router.push(buildUrl(newSeasonType, newWeek, selectedTeamId));
  };

  const navigateSeasonType = (seasonType: number) => {
    router.push(buildUrl(seasonType, 1, selectedTeamId));
  };

  const handleTeamChange = (teamId: string) => {
    if (teamId) {
      // Navigate to team-specific schedule page
      router.push(`/schedule/team/${teamId}`);
    } else {
      router.push(`/schedule/${currentSeasonType}/${currentWeek}`);
    }
  };

  // Sort teams alphabetically by name
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mb-6">
      {/* lg+ gets this heading from the column's own dropdown header instead
          (see PanelSelect) -- below that there's no header row at all, so
          this is the only page title a phone gets. */}
      <h1 className="lg:hidden text-2xl font-bold text-base-content mb-4">Schedule</h1>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col @sm:flex-row justify-between items-center gap-4">
          {/* Week Navigation */}
          <div className="join">
            <Button
              onClick={() => navigateWeek("prev")}
              className="join-item"
              variant="ghost"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="join-item btn btn-ghost pointer-events-none font-medium">
              Week {currentWeek}
            </div>
            <Button
              onClick={() => navigateWeek("next")}
              className="join-item"
              variant="ghost"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Season Type Navigation */}
          <div className="flex gap-1">
            <Button
              onClick={() => navigateSeasonType(1)}
              variant={currentSeasonType === 1 ? "primary" : "ghost"}
              className="text-sm"
            >
              Preseason
            </Button>
            <Button
              onClick={() => navigateSeasonType(2)}
              variant={currentSeasonType === 2 ? "primary" : "ghost"}
              className="text-sm"
            >
              Regular
            </Button>
            <Button
              onClick={() => navigateSeasonType(3)}
              variant={currentSeasonType === 3 ? "primary" : "ghost"}
              className="text-sm"
            >
              Playoffs
            </Button>
          </div>
        </div>

        {/* Team Filter */}
        <div className="flex justify-center @sm:justify-start">
          <select
            className="select w-full max-w-xs bg-base-100 text-base-content"
            value={selectedTeamId || ""}
            onChange={(e) => handleTeamChange(e.target.value)}
          >
            <option value="" className="bg-base-100 text-base-content">All Teams</option>
            {sortedTeams.map((team) => (
              <option key={team.id} value={team.id} className="bg-base-100 text-base-content">
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
