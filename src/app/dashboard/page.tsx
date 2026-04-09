"use client";

import { useMemo } from "react";
import schedule from "@/data/schedule.json";
import { useUserPrefs } from "@/context/UserPrefsContext";
import { Game, Team, Schedule, Level, Score } from "@/lib/types";
import { getRanking } from "@/data/rankings";
import { getLogoUrl } from "@/data/logos";
import Link from "next/link";

const data = schedule as Schedule;
const allTeams: Team[] = data.levels.flatMap((l) => l.teams as Team[]);
const teamMap = new Map(allTeams.map((t) => [t.id, t]));

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

// Compute a team's tournament record from entered scores
function getTourneyRecord(teamId: string, scores: Record<string, Score>): { w: number; l: number; t: number; gp: number } {
  const team = teamMap.get(teamId);
  if (!team) return { w: 0, l: 0, t: 0, gp: 0 };
  const level = data.levels.find((l) => l.id === team.levelId);
  if (!level) return { w: 0, l: 0, t: 0, gp: 0 };

  let w = 0, l = 0, t = 0;
  for (const game of level.games as Game[]) {
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) continue;
    const score = scores[String(game.id)];
    if (!score) continue;

    const isHome = game.homeTeamId === teamId;
    const myGoals = isHome ? score.home : score.away;
    const theirGoals = isHome ? score.away : score.home;

    if (myGoals > theirGoals) w++;
    else if (theirGoals > myGoals) l++;
    else t++;
  }
  return { w, l, t, gp: w + l + t };
}

interface NextGame {
  game: Game;
  level: Level;
  opponent: Team | null;
}

function LogoOrInitials({ name, size = 36 }: { name: string; size?: number }) {
  const url = getLogoUrl(name);
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover bg-slate-100"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(" ")
    .filter((w) => w[0] && w[0] === w[0].toUpperCase())
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: `hsl(${hue}, 50%, 45%)` }}
    >
      {initials}
    </div>
  );
}

// Record pill: shows W-L-T with color coding
function RecordPill({ w, l, t }: { w: number; l: number; t: number }) {
  const gp = w + l + t;
  if (gp === 0) {
    return <span className="text-xs text-slate-400">0-0-0</span>;
  }
  return (
    <span className="text-xs font-semibold">
      <span className="text-green-600">{w}W</span>
      <span className="text-slate-300 mx-0.5">-</span>
      <span className="text-red-500">{l}L</span>
      <span className="text-slate-300 mx-0.5">-</span>
      <span className="text-slate-500">{t}T</span>
    </span>
  );
}

export default function DashboardPage() {
  const { myKidTeams, friendTeams, scores, hydrated } = useUserPrefs();

  // Kid team objects with rankings + next game + tourney record
  const kidCards = useMemo(() => {
    return myKidTeams.map((id) => {
      const team = teamMap.get(id);
      if (!team) return null;
      const ranking = getRanking(team.levelId, team.name);
      const record = getTourneyRecord(id, scores);
      const level = data.levels.find((l) => l.id === team.levelId) as Level | undefined;

      let nextGame: NextGame | null = null;
      if (level) {
        const games = (level.games as Game[])
          .filter((g) => g.phase === "round-robin" && (g.homeTeamId === id || g.awayTeamId === id))
          .sort((a, b) => {
            const dayOrder: Record<string, number> = { "Apr 10": 0, "Apr 11": 1, "Apr 12": 2 };
            const dd = (dayOrder[a.date] ?? 0) - (dayOrder[b.date] ?? 0);
            if (dd !== 0) return dd;
            return parseTime(a.time) - parseTime(b.time);
          });
        // Find first game without a score
        for (const g of games) {
          if (scores[String(g.id)]) continue;
          const opponentId = g.homeTeamId === id ? g.awayTeamId : g.homeTeamId;
          const opponent = opponentId ? teamMap.get(opponentId) ?? null : null;
          nextGame = { game: g, level, opponent };
          break;
        }
        // If all scored, show first game
        if (!nextGame && games.length > 0) {
          const g = games[0];
          const opponentId = g.homeTeamId === id ? g.awayTeamId : g.homeTeamId;
          const opponent = opponentId ? teamMap.get(opponentId) ?? null : null;
          nextGame = { game: g, level, opponent };
        }
      }

      return { team, ranking, record, nextGame };
    }).filter(Boolean) as { team: Team; ranking: ReturnType<typeof getRanking>; record: ReturnType<typeof getTourneyRecord>; nextGame: NextGame | null }[];
  }, [myKidTeams, scores]);

  // Friend team objects with tourney records
  const friendCards = useMemo(() => {
    return friendTeams.map((id) => {
      const team = teamMap.get(id);
      if (!team) return null;
      const ranking = getRanking(team.levelId, team.name);
      const record = getTourneyRecord(id, scores);
      return { team, ranking, record };
    }).filter(Boolean) as { team: Team; ranking: ReturnType<typeof getRanking>; record: ReturnType<typeof getTourneyRecord> }[];
  }, [friendTeams, scores]);

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
        <p className="text-sm text-slate-500 mb-6">
          Add your kid&apos;s team to get started.
        </p>
        <Link
          href="/my-teams"
          className="bg-[var(--color-primary)] text-white py-3 px-6 rounded-lg font-semibold text-sm"
        >
          Add Teams
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-5">
      {/* Kid team cards */}
      <div className="space-y-3 mb-6">
        {kidCards.map(({ team, ranking, record, nextGame }) => (
          <Link
            key={team.id}
            href={`/level/${team.levelId}`}
            className="block bg-white rounded-xl border border-slate-200 p-4 active:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <LogoOrInitials name={team.name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-slate-900 truncate">{team.name}</span>
                  <span className="text-xs font-semibold text-[var(--color-primary)] bg-blue-50 px-1.5 py-0.5 rounded">
                    {team.levelId.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {ranking && (
                    <span className="text-xs text-slate-500">Rank #{ranking.rank}</span>
                  )}
                  <span className="text-slate-300">·</span>
                  <RecordPill w={record.w} l={record.l} t={record.t} />
                </div>
              </div>
            </div>
            {nextGame && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                <span className="text-slate-500">{record.gp === 0 ? "First: " : "Next: "}</span>
                <span className="font-semibold text-slate-800">
                  vs {nextGame.opponent ? nextGame.opponent.displayName : "TBD"}
                  {nextGame.opponent && (() => {
                    const r = getRanking(nextGame.opponent.levelId, nextGame.opponent.name);
                    return r ? ` (#${r.rank})` : "";
                  })()}
                </span>
                <span className="text-slate-400 ml-1">
                  · {nextGame.game.day} {nextGame.game.time}
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Friends Updates */}
      {friendCards.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Friends Updates</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex animate-marquee gap-8 px-4 py-4">
              {[...friendCards, ...friendCards].map(({ team, ranking, record }, i) => (
                <div key={`${team.id}-${i}`} className="flex items-center gap-3 shrink-0">
                  <LogoOrInitials name={team.name} size={36} />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                        {team.name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {team.levelId.toUpperCase()}
                      </span>
                      {ranking && (
                        <span className="text-[10px] text-slate-400">#{ranking.rank}</span>
                      )}
                    </div>
                    <RecordPill w={record.w} l={record.l} t={record.t} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/levels"
          className="bg-white rounded-xl border border-slate-200 p-4 text-center active:bg-slate-50"
        >
          <svg className="w-6 h-6 mx-auto mb-1 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <div className="text-sm font-semibold text-slate-700">Schedule</div>
        </Link>
        <Link
          href="/results"
          className="bg-white rounded-xl border border-slate-200 p-4 text-center active:bg-slate-50"
        >
          <svg className="w-6 h-6 mx-auto mb-1 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div className="text-sm font-semibold text-slate-700">Results</div>
        </Link>
      </div>
    </div>
  );
}
