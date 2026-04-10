"use client";

import { useParams } from "next/navigation";
import schedule from "@/data/schedule.json";
import { useUserPrefs } from "@/context/UserPrefsContext";
import { Level, Team, Schedule } from "@/lib/types";
import { calculatePoolStandings } from "@/lib/standings";
import { getRanking } from "@/data/rankings";
import Link from "next/link";

const data = schedule as Schedule;

export default function StandingsPage() {
  const params = useParams();
  const levelId = params.levelId as string;
  const level = data.levels.find((l) => l.id === levelId) as Level | undefined;
  const { scores, trackedTeams, hydrated } = useUserPrefs();

  if (!level) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold">Level not found</h1>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <Link href={`/level/${levelId}`} className="text-xs text-slate-500 hover:text-slate-700">
        &larr; {level.name}
      </Link>
      <h1 className="text-xl font-bold mb-4">{level.name} Standings</h1>

      {level.pools.map((pool) => {
        const standings = calculatePoolStandings(level as Level, pool.id, scores);

        return (
          <div key={pool.id} className="mb-6">
            <h2 className="text-sm font-bold text-slate-700 mb-2">Pool {pool.id}</h2>
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-semibold">#</th>
                    <th className="text-left py-2 px-2 font-semibold">Team</th>
                    <th className="text-center py-2 px-1 font-semibold text-amber-700">Rnk</th>
                    <th className="text-center py-2 px-1 font-semibold">GP</th>
                    <th className="text-center py-2 px-1 font-semibold">W</th>
                    <th className="text-center py-2 px-1 font-semibold">L</th>
                    <th className="text-center py-2 px-1 font-semibold">T</th>
                    <th className="text-center py-2 px-1 font-semibold text-[var(--color-primary)]">Pts</th>
                    <th className="text-center py-2 px-1 font-semibold">GF</th>
                    <th className="text-center py-2 px-1 font-semibold">GA</th>
                    <th className="text-center py-2 px-1 font-semibold">GD</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => {
                    const isTracked = trackedTeams.includes(s.teamId);
                    return (
                      <tr
                        key={s.teamId}
                        className={`border-b border-slate-100 last:border-0 ${
                          isTracked ? "bg-blue-50" : ""
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                        <td className={`py-2 px-2 ${isTracked ? "font-bold text-[var(--color-primary)]" : ""}`}>
                          {s.teamName}
                        </td>
                        <td className="text-center py-2 px-1 text-amber-700 font-semibold">
                          {(() => {
                            const team = (level.teams as Team[]).find((t) => t.id === s.teamId);
                            const r = team ? getRanking(team.levelId, team.name) : undefined;
                            return r ? r.rank : "—";
                          })()}
                        </td>
                        <td className="text-center py-2 px-1">{s.gp}</td>
                        <td className="text-center py-2 px-1">{s.w}</td>
                        <td className="text-center py-2 px-1">{s.l}</td>
                        <td className="text-center py-2 px-1">{s.t}</td>
                        <td className="text-center py-2 px-1 font-bold text-[var(--color-primary)]">{s.pts}</td>
                        <td className="text-center py-2 px-1">{s.gf}</td>
                        <td className="text-center py-2 px-1">{s.ga}</td>
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
        );
      })}

      {/* Rules reference */}
      <div className="mt-8 p-3 bg-slate-100 rounded-lg text-xs text-slate-600">
        <p className="font-semibold mb-1">Tiebreaker Rules (OWHA)</p>
        <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
          <li>Total points</li>
          <li>Most wins</li>
          <li>Record against tied teams</li>
          <li>Goal difference (GF - GA)</li>
          <li>Fewest goals allowed</li>
          <li>Most periods won</li>
          <li>Fewest penalty minutes</li>
          <li>First goal scored</li>
          <li>Coin flip</li>
        </ol>
        <p className="mt-2">
          <a
            href="https://cloud3.rampinteractive.com/whaontario/files/Provincials/2026/2026%20OWHA%20Provincial%20Championship%20Playing%20Rules.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-primary)] underline"
          >
            Official Playing Rules (PDF)
          </a>
        </p>
      </div>
    </div>
  );
}
