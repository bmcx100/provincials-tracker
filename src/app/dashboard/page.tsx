"use client";

import { useState, useMemo } from "react";
import schedule from "@/data/schedule.json";
import { useUserPrefs } from "@/context/UserPrefsContext";
import { Game, Team, Schedule, Level } from "@/lib/types";
import GameCard from "@/components/GameCard";
import ScoreEntryModal from "@/components/ScoreEntryModal";
import Link from "next/link";

const data = schedule as Schedule;

interface GameWithLevel {
  game: Game;
  level: Level;
}

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

export default function DashboardPage() {
  const { trackedTeams, scores, hydrated, setScore, clearScore } = useUserPrefs();
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editingTeams, setEditingTeams] = useState<Team[]>([]);

  // Find all games involving tracked teams
  const trackedGames = useMemo(() => {
    if (!trackedTeams.length) return [];
    const teamSet = new Set(trackedTeams);
    const games: GameWithLevel[] = [];

    for (const level of data.levels) {
      for (const game of level.games as Game[]) {
        const involves =
          (game.homeTeamId && teamSet.has(game.homeTeamId)) ||
          (game.awayTeamId && teamSet.has(game.awayTeamId));
        if (involves) {
          games.push({ game, level: level as Level });
        }
      }
    }
    return games;
  }, [trackedTeams]);

  // Group by day
  const groupedByDay = useMemo(() => {
    const groups: Record<string, GameWithLevel[]> = {};
    for (const gw of trackedGames) {
      const key = `${gw.game.day}, ${gw.game.date}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(gw);
    }
    // Sort games within each day by time
    for (const key in groups) {
      groups[key].sort((a, b) => parseTime(a.game.time) - parseTime(b.game.time));
    }
    return groups;
  }, [trackedGames]);

  const dayOrder = ["Friday, Apr 10", "Saturday, Apr 11", "Sunday, Apr 12"];
  const sortedDays = Object.keys(groupedByDay).sort(
    (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
  );

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!trackedTeams.length) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold mb-2">No teams selected</h1>
        <p className="text-sm text-slate-500 mb-6">
          Pick your team to start tracking games.
        </p>
        <Link
          href="/select"
          className="bg-[var(--color-primary)] text-white py-3 px-6 rounded-lg font-semibold text-sm"
        >
          Select Teams
        </Link>
      </div>
    );
  }

  const handleScoreTap = (game: Game, level: Level) => {
    setEditingGame(game);
    setEditingTeams(level.teams as Team[]);
  };

  // Find all teams for the editing game's level
  const editingLevel = editingGame
    ? data.levels.find((l) => l.id === editingGame.levelId) as Level | undefined
    : undefined;

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <h1 className="text-xl font-bold mb-4">Dashboard</h1>

      {sortedDays.map((day) => (
        <div key={day} className="mb-6">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2 sticky top-0 bg-slate-50 py-1 z-10">
            {day}
          </h2>
          <div className="space-y-2">
            {groupedByDay[day].map(({ game, level }) => (
              <div key={game.id}>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5 ml-1">
                  {level.name}
                </div>
                <GameCard
                  game={game}
                  teams={level.teams as Team[]}
                  score={scores[String(game.id)]}
                  onScoreTap={(g) => handleScoreTap(g, level)}
                  highlightTeamIds={trackedTeams}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <ScoreEntryModal
        game={editingGame}
        teams={editingTeams}
        currentScore={editingGame ? scores[String(editingGame.id)] : undefined}
        onSave={setScore}
        onClear={clearScore}
        onClose={() => setEditingGame(null)}
      />
    </div>
  );
}
