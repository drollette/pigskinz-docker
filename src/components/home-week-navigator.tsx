"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";

interface HomeWeekNavigatorProps {
  currentWeek: number;
  currentSeasonType: number;
}

export function HomeWeekNavigator({
  currentWeek,
  currentSeasonType,
}: HomeWeekNavigatorProps) {
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

    router.push(`/?seasonType=${newSeasonType}&week=${newWeek}`);
  };

  const navigateSeasonType = (seasonType: number) => {
    router.push(`/?seasonType=${seasonType}&week=1`);
  };

  return (
    <div className="mb-6">
      {/* lg+ gets this heading from the column's own dropdown header instead
          (see PanelSelect) -- below that there's no header row at all, so
          this is the only page title a phone gets. */}
      <h1 className="lg:hidden text-2xl font-bold text-base-content mb-4">Pool Standings</h1>

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
    </div>
  );
}
