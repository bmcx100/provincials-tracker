"use client";

import { useMemo } from "react";
import schedule from "@/data/schedule.json";
import { useUserPrefs } from "@/context/UserPrefsContext";
import { Team, Level, Schedule } from "@/lib/types";
import { calculatePoolStandings } from "@/lib/standings";
import { getRanking } from "@/data/rankings";
import Link from "next/link";

const data = schedule as Schedule;

export default function ResultsPage() {
  const { myKidTeams, scores, hydrated } = useUserPrefs();

  const kidSet = useMemo(() => new Set(myKidTeams), [myKidTeams]);

  // Get levels that have kid teams
  const relevantLevels = useMemo(() => {
    if (!myKidTeams.length) return [];
    const levels: Level[] = [];
    for (const level of data.levels) {
      const hasKid = (level.teams as Team[]).some((t) => kidSet.has(t.id));
      if (hasKid) levels.push(level as Level);
    }
    return levels;
  }, [myKidTeams, kidSet]);

  // For each level, find pools containing kid teams
  const levelData = useMemo(() => {
    return relevantLevels.map((level) => {
      const kidPools = level.pools.filter((pool) =>
        pool.teams.some((tid) => kidSet.has(tid))
      );
      const standings = kidPools.map((pool) => ({
        pool,
        standings: calculatePoolStandings(level, pool.id, scores),
      }));
      return { level, standings };
    });
  }, [relevantLevels, scores, kidSet]);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!myKidTeams.length) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold mb-2">Results</h1>
        <p className="text-sm text-slate-500 mb-6">
          Add your kid&apos;s team to see standings here.
        </p>
        <Link
          href="/my-teams"
          className="inline-block bg-[var(--color-primary)] text-white py-3 px-6 rounded-lg font-semibold text-sm"
        >
          Go to My Teams
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <h1 className="text-xl font-bold mb-4">Results</h1>

      {levelData.map(({ level, standings }) => (
        <div key={level.id} className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">{level.name}</h2>
            <Link
              href={`/level/${level.id}`}
              className="text-xs text-[var(--color-primary)] font-medium"
            >
              Full schedule &rarr;
            </Link>
          </div>

          {standings.map(({ pool, standings: poolStandings }) => (
            <div key={pool.id} className="mb-4">
              <h3 className="text-sm font-bold text-slate-700 mb-2">Pool {pool.id}</h3>
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-semibold">#</th>
                      <th className="text-left py-2 px-2 font-semibold">Team</th>
                      <th className="text-center py-2 px-1 font-semibold">GP</th>
                      <th className="text-center py-2 px-1 font-semibold">W</th>
                      <th className="text-center py-2 px-1 font-semibold">L</th>
                      <th className="text-center py-2 px-1 font-semibold">T</th>
                      <th className="text-center py-2 px-1 font-semibold text-[var(--color-primary)]">Pts</th>
                      <th className="text-center py-2 px-1 font-semibold">GD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolStandings.map((s, i) => {
                      const isKid = kidSet.has(s.teamId);
                      const team = (level.teams as Team[]).find((t) => t.id === s.teamId);
                      const ranking = team ? getRanking(team.levelId, team.name) : undefined;
                      return (
                        <tr
                          key={s.teamId}
                          className={`border-b border-slate-100 last:border-0 ${isKid ? "bg-blue-50" : ""}`}
                        >
                          <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                          <td className={`py-2 px-2 ${isKid ? "font-bold text-[var(--color-primary)]" : ""}`}>
                            {s.teamName}
                            {ranking && (
                              <span className="text-[10px] text-slate-400 ml-1">#{ranking.rank}</span>
                            )}
                          </td>
                          <td className="text-center py-2 px-1">{s.gp}</td>
                          <td className="text-center py-2 px-1">{s.w}</td>
                          <td className="text-center py-2 px-1">{s.l}</td>
                          <td className="text-center py-2 px-1">{s.t}</td>
                          <td className="text-center py-2 px-1 font-bold text-[var(--color-primary)]">{s.pts}</td>
                          <td className="text-center py-2 px-1">
                            {s.gd > 0 ? `+${s.gd}` : s.gd}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
