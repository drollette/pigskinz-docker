"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Team {
  id: string;
  name: string;
  abbreviation: string;
  logo: string | null;
}

interface TeamScheduleHeaderProps {
  team: Team;
  teams: Team[];
}

export function TeamScheduleHeader({ team, teams }: TeamScheduleHeaderProps) {
  const router = useRouter();

  // Sort teams alphabetically
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  const handleTeamChange = (teamId: string) => {
    if (teamId) {
      router.push(`/schedule/team/${teamId}`);
    } else {
      router.push("/schedule");
    }
  };

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          <Link href="/schedule">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {team.logo && (
              <img
                src={team.logo}
                alt={team.name}
                className="w-12 h-12 object-contain"
              />
            )}
            <h1 className="text-2xl font-bold text-base-content">{team.name} Schedule</h1>
          </div>
        </div>
      </div>

      <div className="flex justify-center sm:justify-start">
        <select
          className="select w-full max-w-xs bg-base-100 text-base-content"
          value={team.id}
          onChange={(e) => handleTeamChange(e.target.value)}
        >
          <option value="" className="bg-base-100 text-base-content">All Teams (Weekly View)</option>
          {sortedTeams.map((t) => (
            <option key={t.id} value={t.id} className="bg-base-100 text-base-content">
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
