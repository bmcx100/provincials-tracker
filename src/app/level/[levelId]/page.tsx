"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import schedule from "@/data/schedule.json";
import { useUserPrefs } from "@/context/UserPrefsContext";
import { Game, Team, Level, Schedule } from "@/lib/types";
import GameCard from "@/components/GameCard";
import ScoreEntryModal from "@/components/ScoreEntryModal";
import Link from "next/link";

const data = schedule as Schedule;

function parseTime(time: string): number {
  const match = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export default function LevelPage() {
  const params = useParams();
  const levelId = params.levelId as string;
  const level = data.levels.find((l) => l.id === levelId) as Level | undefined;
  const { scores, trackedTeams, hydrated, setScore, clearScore } = useUserPrefs();
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [activeTab, setActiveTab] = useState<"schedule" | "pools">("schedule");

  if (!level) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold">Level not found</h1>
      </div>
    );
  }

  const games = [...(level.games as Game[])].sort(
    (a, b) => parseTime(a.time) - parseTime(b.time)
  );

  // Group by day
  const dayGroups: Record<string, Game[]> = {};
  for (const game of games) {
    const key = `${game.day}, ${game.date}`;
    if (!dayGroups[key]) dayGroups[key] = [];
    dayGroups[key].push(game);
  }

  const dayOrder = ["Friday, Apr 10", "Saturday, Apr 11", "Sunday, Apr 12"];
  const sortedDays = Object.keys(dayGroups).sort(
    (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href="/levels" className="text-xs text-slate-500 hover:text-slate-700">
            &larr; All Levels
          </Link>
          <h1 className="text-xl font-bold">{level.name}</h1>
          <p className="text-xs text-slate-500">
            {level.teams.length} teams · {level.pools.length} pools · {level.playoffFormat}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/level/${levelId}/standings`}
            className="text-xs bg-slate-100 px-3 py-1.5 rounded-md font-medium hover:bg-slate-200"
          >
            Standings
          </Link>
          <Link
            href={`/level/${levelId}/bracket`}
            className="text-xs bg-slate-100 px-3 py-1.5 rounded-md font-medium hover:bg-slate-200"
          >
            Bracket
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4">
        <button
          onClick={() => setActiveTab("schedule")}
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "schedule"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500"
          }`}
        >
          Schedule
        </button>
        <button
          onClick={() => setActiveTab("pools")}
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "pools"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500"
          }`}
        >
          Pools
        </button>
      </div>

      {activeTab === "schedule" && (
        <>
          {sortedDays.map((day) => (
            <div key={day} className="mb-6">
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2 sticky top-0 bg-slate-50 py-1 z-10">
                {day}
              </h2>
              <div className="space-y-2">
                {dayGroups[day].map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    teams={level.teams as Team[]}
                    score={scores[String(game.id)]}
                    onScoreTap={setEditingGame}
                    highlightTeamIds={hydrated ? trackedTeams : []}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {activeTab === "pools" && (
        <div className="space-y-4">
          {level.pools.map((pool) => {
            const poolTeams = pool.teams
              .map((id) => (level.teams as Team[]).find((t) => t.id === id))
              .filter(Boolean) as Team[];
            return (
              <div
                key={pool.id}
                className="bg-white rounded-lg border border-slate-200 p-3"
              >
                <h3 className="text-sm font-bold mb-2">Pool {pool.id}</h3>
                <div className="space-y-1">
                  {poolTeams.map((team) => (
                    <div
                      key={team.id}
                      className={`text-sm py-1 px-2 rounded ${
                        trackedTeams.includes(team.id)
                          ? "bg-blue-50 font-semibold text-[var(--color-primary)]"
                          : ""
                      }`}
                    >
                      {team.displayName}
                      <span className="text-slate-400 text-xs ml-1">#{team.number}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ScoreEntryModal
        game={editingGame}
        teams={level.teams as Team[]}
        currentScore={editingGame ? scores[String(editingGame.id)] : undefined}
        onSave={setScore}
        onClear={clearScore}
        onClose={() => setEditingGame(null)}
      />
    </div>
  );
}
