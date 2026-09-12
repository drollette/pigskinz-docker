"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

const COLORS = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
];

interface WeeklyChartProps {
  data: Array<{
    week: string;
    [key: string]: string | number;
  }>;
  players: string[];
}

export function WeeklyPerformanceChart({ data, players }: WeeklyChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-base-content/50">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="week"
          stroke="#9ca3af"
          tick={{ fill: "#9ca3af", fontSize: 12 }}
        />
        <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "#f3f4f6" }}
        />
        <Legend />
        {players.map((player, index) => (
          <Line
            key={player}
            type="monotone"
            dataKey={player}
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={2}
            dot={{ fill: COLORS[index % COLORS.length], strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

interface TeamStatsChartProps {
  data: Array<{
    teamAbbr: string;
    totalPicks: number;
    correctPicks: number;
    winRate: number;
  }>;
}

export function TeamPicksChart({ data }: TeamStatsChartProps) {
  // Show top 10 most picked teams
  const topTeams = data.slice(0, 10);

  if (topTeams.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-base-content/50">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={topTeams} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="teamAbbr"
          stroke="#9ca3af"
          tick={{ fill: "#9ca3af", fontSize: 12 }}
        />
        <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "#f3f4f6" }}
          formatter={(value, name) => {
            if (name === "winRate") return [`${value}%`, "Win Rate"];
            return [value, name === "totalPicks" ? "Total Picks" : "Correct"];
          }}
        />
        <Legend />
        <Bar dataKey="totalPicks" name="Total Picks" fill="#3b82f6" radius={[4, 4, 0, 0]}>
          {topTeams.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
        <Bar dataKey="correctPicks" name="Correct" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface WinRateChartProps {
  data: Array<{
    teamAbbr: string;
    winRate: number;
    totalPicks: number;
  }>;
}

export function TeamWinRateChart({ data }: WinRateChartProps) {
  // Filter teams with at least 5 picks and sort by win rate
  const qualifiedTeams = data
    .filter(t => t.totalPicks >= 5)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 10);

  if (qualifiedTeams.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-base-content/50">
        No data available (need at least 5 picks per team)
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={qualifiedTeams}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          type="number"
          domain={[0, 100]}
          stroke="#9ca3af"
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          tickFormatter={(value) => `${value}%`}
        />
        <YAxis
          type="category"
          dataKey="teamAbbr"
          stroke="#9ca3af"
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "#f3f4f6" }}
          formatter={(value) => [`${value}%`, "Win Rate"]}
        />
        <Bar dataKey="winRate" name="Win Rate" radius={[0, 4, 4, 0]}>
          {qualifiedTeams.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.winRate >= 60 ? "#22c55e" : entry.winRate >= 40 ? "#f59e0b" : "#ef4444"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
