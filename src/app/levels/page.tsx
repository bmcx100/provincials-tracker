"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import schedule from "@/data/schedule.json";
import { useUserPrefs } from "@/context/UserPrefsContext";
import { Game, Team, Schedule, Level, TeamRef, Score } from "@/lib/types";
import { resolveParticipant } from "@/lib/bracket";
import { getRanking } from "@/data/rankings";
import Link from "next/link";

const data = schedule as Schedule;
const allTeamsArr: Team[] = data.levels.flatMap((l) => l.teams as Team[]);
const teamMap = new Map(allTeamsArr.map((t) => [t.id, t]));

const DAYS = [
  { date: "Apr 10", label: "Friday 10th", full: "Friday" },
  { date: "Apr 11", label: "Saturday 11th", full: "Saturday" },
  { date: "Apr 12", label: "Sunday 12th", full: "Sunday" },
];

// Game durations (wall-clock estimates) per 2026 OWHA Provincial rules (data/rules.json):
function getGameDuration(_levelId: string, phase: string): number {
  return phase === "round-robin" ? 60 : 65;
}

const HOUR_HEIGHT = 45;
const START_HOUR = 6.5;
const FIRST_LABEL_HOUR = 7;
const LAST_LABEL_HOUR = 23;
const END_HOUR = 23.5;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const TOTAL_HEIGHT = (TOTAL_MINUTES / 60) * HOUR_HEIGHT;

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

function formatHour(hour: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "a" : "p";
  return `${h}${ampm}`;
}

function describeRef(ref?: TeamRef): string {
  if (!ref) return "TBD";
  switch (ref.type) {
    case "pool-rank":
      return ref.pool ? `1st Pool ${ref.pool}` : `Rank #${ref.rank}`;
    case "game-winner":
      return `W${ref.gameId}`;
    case "game-loser":
      return `L${ref.gameId}`;
  }
}

// Append provincial rank to a display name
function withRank(name: string, levelId: string, assocName: string): string {
  const r = getRanking(levelId, assocName);
  return r ? `${name} (#${r.rank})` : name;
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case "quarter-final": return "QF";
    case "semi-final": return "SF";
    case "gold-medal": return "Final";
    case "bronze-medal": return "Bronze";
    default: return "";
  }
}

function getRelevantPlayoffGameIds(level: Level, teamPool: string): Set<number> {
  const playoffs = (level.games as Game[]).filter((g) => g.phase !== "round-robin");
  if (playoffs.length === 0) return new Set();

  const hasPoolRefs = playoffs.some(
    (g) =>
      (g.homeRef?.type === "pool-rank" && g.homeRef.pool) ||
      (g.awayRef?.type === "pool-rank" && g.awayRef.pool)
  );
  if (!hasPoolRefs) return new Set(playoffs.map((g) => g.id));

  const relevant = new Set<number>();
  const refMatchesPool = (ref?: TeamRef) =>
    ref?.type === "pool-rank" && ref.pool === teamPool;

  for (const g of playoffs) {
    if (refMatchesPool(g.homeRef) || refMatchesPool(g.awayRef)) {
      relevant.add(g.id);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const g of playoffs) {
      if (relevant.has(g.id)) continue;
      const refsGame = (ref?: TeamRef) =>
        (ref?.type === "game-winner" || ref?.type === "game-loser") &&
        relevant.has(ref.gameId);
      if (refsGame(g.homeRef) || refsGame(g.awayRef)) {
        relevant.add(g.id);
        changed = true;
      }
    }
  }

  return relevant;
}

function buildTeamHueMap(teamIds: string[]): Map<string, number> {
  const map = new Map<string, number>();
  const step = teamIds.length > 0 ? 360 / teamIds.length : 0;
  for (let i = 0; i < teamIds.length; i++) {
    map.set(teamIds[i], Math.round(i * step) % 360);
  }
  return map;
}

// Extract venue name from rink string (strip trailing pad/rink number)
function getVenue(rink: string): string {
  return rink
    .replace(/\s*[-–]\s*(Rink|Pad)\s*\d+\s*$/i, "")
    .replace(/\s*(Rink|Pad)\s*[A-Z0-9]+\s*$/i, "")
    .replace(/\s*\d+\s*$/, "")
    .replace(/\s*\(rink \d+\).*$/i, "")
    .trim();
}

interface CalendarGame {
  game: Game;
  level: Level;
  trackedTeam: Team;
  startMin: number;
  duration: number;
  topPx: number;
  heightPx: number;
  column: number;
  totalColumns: number;
  isFriend: boolean;
}

function layoutGames(games: { game: Game; level: Level; trackedTeam: Team; startMin: number; isFriend: boolean }[]): CalendarGame[] {
  if (games.length === 0) return [];

  const sorted = [...games].sort((a, b) => a.startMin - b.startMin);

  const result: CalendarGame[] = sorted.map((g) => {
    const duration = getGameDuration(g.level.id, g.game.phase);
    return {
      ...g,
      duration,
      topPx: ((g.startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT,
      heightPx: (duration / 60) * HOUR_HEIGHT,
      column: 0,
      totalColumns: 1,
    };
  });

  const active: { endMin: number; column: number }[] = [];
  for (const g of result) {
    const endMin = g.startMin + g.duration;
    const stillActive = active.filter((a) => a.endMin > g.startMin);
    const usedCols = new Set(stillActive.map((a) => a.column));
    let col = 0;
    while (usedCols.has(col)) col++;
    g.column = col;
    active.length = 0;
    active.push(...stillActive, { endMin, column: col });
  }

  const groups: CalendarGame[][] = [];
  let group: CalendarGame[] = [];
  let groupEnd = 0;
  for (const g of result) {
    if (group.length === 0 || g.startMin < groupEnd) {
      group.push(g);
      groupEnd = Math.max(groupEnd, g.startMin + g.duration);
    } else {
      groups.push(group);
      group = [g];
      groupEnd = g.startMin + g.duration;
    }
  }
  if (group.length > 0) groups.push(group);
  for (const grp of groups) {
    const maxCol = Math.max(...grp.map((g) => g.column)) + 1;
    for (const g of grp) g.totalColumns = maxCol;
  }

  return result;
}

type FriendFilter = "off" | "near-my-rink" | "all-their-games";

export default function SchedulePage() {
  const { myKidTeams, friendTeams, scores, hydrated } = useUserPrefs();
  const [dayIndex, setDayIndex] = useState(0);
  const [friendFilter, setFriendFilter] = useState<FriendFilter>("off");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const kidSet = useMemo(() => new Set(myKidTeams), [myKidTeams]);
  const friendSet = useMemo(() => new Set(friendTeams), [friendTeams]);
  const allTracked = useMemo(() => [...new Set([...myKidTeams, ...friendTeams])], [myKidTeams, friendTeams]);

  const teamHueMap = useMemo(() => buildTeamHueMap(allTracked), [allTracked]);

  // Pre-compute relevant playoff game IDs per tracked team
  const relevantPlayoffs = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const id of allTracked) {
      const team = teamMap.get(id);
      if (!team) continue;
      const level = data.levels.find((l) => l.id === team.levelId);
      if (!level) continue;
      map.set(id, getRelevantPlayoffGameIds(level as Level, team.pool));
    }
    return map;
  }, [allTracked]);

  // Build all kid games per day (always shown)
  const kidGames = useMemo(() => {
    const result: Record<string, { game: Game; level: Level; trackedTeam: Team; startMin: number; isFriend: boolean }[]> = {};
    for (const day of DAYS) result[day.date] = [];

    for (const level of data.levels) {
      for (const game of level.games as Game[]) {
        if (!result[game.date]) continue;

        if (game.phase === "round-robin") {
          const home = game.homeTeamId ? teamMap.get(game.homeTeamId) : null;
          const away = game.awayTeamId ? teamMap.get(game.awayTeamId) : null;
          const tracked = (home && kidSet.has(home.id)) ? home : (away && kidSet.has(away.id)) ? away : null;
          if (tracked) {
            result[game.date].push({
              game, level: level as Level, trackedTeam: tracked, startMin: parseTime(game.time), isFriend: false,
            });
          }
        } else {
          for (const id of myKidTeams) {
            const team = teamMap.get(id);
            if (!team || team.levelId !== level.id) continue;
            const relevant = relevantPlayoffs.get(id);
            if (relevant?.has(game.id)) {
              result[game.date].push({
                game, level: level as Level, trackedTeam: team, startMin: parseTime(game.time), isFriend: false,
              });
              break;
            }
          }
        }
      }
    }
    return result;
  }, [kidSet, myKidTeams, relevantPlayoffs]);

  // Build all friend games per day
  const friendGamesAll = useMemo(() => {
    const result: Record<string, { game: Game; level: Level; trackedTeam: Team; startMin: number; isFriend: boolean }[]> = {};
    for (const day of DAYS) result[day.date] = [];

    for (const level of data.levels) {
      for (const game of level.games as Game[]) {
        if (!result[game.date]) continue;

        if (game.phase === "round-robin") {
          const home = game.homeTeamId ? teamMap.get(game.homeTeamId) : null;
          const away = game.awayTeamId ? teamMap.get(game.awayTeamId) : null;
          const tracked = (home && friendSet.has(home.id)) ? home : (away && friendSet.has(away.id)) ? away : null;
          if (tracked) {
            result[game.date].push({
              game, level: level as Level, trackedTeam: tracked, startMin: parseTime(game.time), isFriend: true,
            });
          }
        } else {
          for (const id of friendTeams) {
            const team = teamMap.get(id);
            if (!team || team.levelId !== level.id) continue;
            const relevant = relevantPlayoffs.get(id);
            if (relevant?.has(game.id)) {
              result[game.date].push({
                game, level: level as Level, trackedTeam: team, startMin: parseTime(game.time), isFriend: true,
              });
              break;
            }
          }
        }
      }
    }
    return result;
  }, [friendSet, friendTeams, relevantPlayoffs]);

  // Kid venues per day (for "near my rink" filter)
  const kidVenuesPerDay = useMemo(() => {
    const result: Record<string, Set<string>> = {};
    for (const day of DAYS) {
      result[day.date] = new Set(
        (kidGames[day.date] || []).map((g) => getVenue(g.game.rink))
      );
    }
    return result;
  }, [kidGames]);

  // Combined + filtered games for current day
  const currentDay = DAYS[dayIndex];
  const dayGames = useMemo(() => {
    let games = [...(kidGames[currentDay.date] || [])];

    if (friendFilter === "all-their-games") {
      // Add all friend games, dedup by game id
      const kidGameIds = new Set(games.map((g) => g.game.id));
      for (const fg of friendGamesAll[currentDay.date] || []) {
        if (!kidGameIds.has(fg.game.id)) {
          games.push(fg);
        }
      }
    } else if (friendFilter === "near-my-rink") {
      // Add friend games at same venue as kid games
      const venues = kidVenuesPerDay[currentDay.date] || new Set();
      const kidGameIds = new Set(games.map((g) => g.game.id));
      for (const fg of friendGamesAll[currentDay.date] || []) {
        if (!kidGameIds.has(fg.game.id) && venues.has(getVenue(fg.game.rink))) {
          games.push(fg);
        }
      }
    }

    return layoutGames(games);
  }, [kidGames, friendGamesAll, kidVenuesPerDay, currentDay.date, friendFilter]);

  // Auto-scroll to first game when day changes
  useEffect(() => {
    if (!scrollRef.current || dayGames.length === 0) return;
    const firstTop = Math.min(...dayGames.map((g) => g.topPx));
    scrollRef.current.scrollTop = Math.max(0, firstTop - 10);
  }, [dayGames, dayIndex]);

  // Swipe handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    touchRef.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && dayIndex < DAYS.length - 1) setDayIndex((i) => i + 1);
      if (dx > 0 && dayIndex > 0) setDayIndex((i) => i - 1);
    }
  }, [dayIndex]);

  // Close filter menu on outside tap
  useEffect(() => {
    if (!showFilterMenu) return;
    const handler = () => setShowFilterMenu(false);
    const timer = setTimeout(() => document.addEventListener("click", handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handler);
    };
  }, [showFilterMenu]);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!allTracked.length) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold mb-2">Schedule</h1>
        <p className="text-sm text-slate-500 mb-6">Add teams to see their schedule.</p>
        <Link href="/my-teams" className="bg-[var(--color-primary)] text-white py-3 px-6 rounded-lg font-semibold text-sm">
          Add Teams
        </Link>
      </div>
    );
  }

  const filterLabel = friendFilter === "off" ? "My Friends" : friendFilter === "near-my-rink" ? "Near My Rink" : "All Friends";

  return (
    <div className="max-w-lg mx-auto flex flex-col" style={{ height: "calc(100dvh - 72px)" }}>
      {/* Spacer above day tabs */}
      <div className="h-3 shrink-0" />

      {/* Day tabs — single line labels */}
      <div className="flex bg-slate-50 border-b border-slate-200 shrink-0">
        {DAYS.map((day, i) => {
          const active = i === dayIndex;
          return (
            <button
              key={day.date}
              onClick={() => setDayIndex(i)}
              className={`flex-1 py-3 text-center transition-colors relative ${
                active ? "bg-white" : "active:bg-slate-100"
              }`}
            >
              <div className={`text-sm font-semibold ${active ? "text-[var(--color-primary)]" : "text-slate-600"}`}>
                {day.label}
              </div>
              {active && <div className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t bg-[var(--color-primary)]" />}
            </button>
          );
        })}
      </div>

      {/* Calendar grid — single day */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative flex" style={{ height: TOTAL_HEIGHT }}>
          {/* Time gutter */}
          <div className="w-11 shrink-0 relative">
            {Array.from({ length: LAST_LABEL_HOUR - FIRST_LABEL_HOUR + 1 }, (_, i) => {
              const hour = FIRST_LABEL_HOUR + i;
              const top = ((hour - START_HOUR) * HOUR_HEIGHT);
              return (
                <div
                  key={hour}
                  className="absolute w-full pr-1.5 text-right text-[11px] text-slate-400 leading-none"
                  style={{ top: top - 6 }}
                >
                  {formatHour(hour)}
                </div>
              );
            })}
          </div>

          {/* Day column */}
          <div className="flex-1 relative border-l border-slate-200">
            {/* Hour gridlines */}
            {Array.from({ length: LAST_LABEL_HOUR - FIRST_LABEL_HOUR + 1 }, (_, i) => {
              const hour = FIRST_LABEL_HOUR + i;
              const top = ((hour - START_HOUR) * HOUR_HEIGHT);
              return (
                <div
                  key={hour}
                  className="absolute w-full border-t border-slate-100"
                  style={{ top }}
                />
              );
            })}

            {/* Game blocks */}
            {dayGames.map((cg) => {
              const isPlayoff = cg.game.phase !== "round-robin";
              const hue = teamHueMap.get(cg.trackedTeam.id) ?? 0;
              const widthPct = 100 / cg.totalColumns;
              const leftPct = cg.column * widthPct;

              let label: string;
              let unresolved = false;

              if (isPlayoff) {
                const homeId = cg.game.homeTeamId ?? resolveParticipant(cg.game.homeRef!, cg.level, scores);
                const awayId = cg.game.awayTeamId ?? resolveParticipant(cg.game.awayRef!, cg.level, scores);
                const homeTeam = homeId ? teamMap.get(homeId) : null;
                const awayTeam = awayId ? teamMap.get(awayId) : null;
                const homeName = homeTeam ? withRank(homeTeam.displayName, homeTeam.levelId, homeTeam.name) : describeRef(cg.game.homeRef);
                const awayName = awayTeam ? withRank(awayTeam.displayName, awayTeam.levelId, awayTeam.name) : describeRef(cg.game.awayRef);
                unresolved = !homeId || !awayId;
                const phase = phaseLabel(cg.game.phase);
                label = `${cg.level.name} ${phase}: ${homeName} vs ${awayName}`;
              } else {
                const home = cg.game.homeTeamId ? teamMap.get(cg.game.homeTeamId) : null;
                const away = cg.game.awayTeamId ? teamMap.get(cg.game.awayTeamId) : null;
                const isHomeTracked = home && (kidSet.has(home.id) || friendSet.has(home.id));
                const tracked = cg.trackedTeam;
                const opponent = isHomeTracked ? away : home;
                const trackedLabel = withRank(tracked.name, tracked.levelId, tracked.name);
                const opponentLabel = opponent ? withRank(opponent.displayName, opponent.levelId, opponent.name) : "TBD";
                label = `${trackedLabel} ${cg.level.name} vs ${opponentLabel}`;
              }

              // Friend games get a dashed left border + slightly lower opacity
              const isFriendGame = cg.isFriend;

              return (
                <Link
                  key={`${cg.game.id}-${cg.trackedTeam.id}`}
                  href={isPlayoff ? `/level/${cg.level.id}/bracket` : `/level/${cg.level.id}`}
                  className={`absolute rounded-lg overflow-hidden active:opacity-80 transition-opacity ${isFriendGame ? "opacity-75" : ""}`}
                  style={{
                    top: cg.topPx + 1,
                    height: cg.heightPx - 2,
                    left: `calc(${leftPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                    backgroundColor: isPlayoff ? `hsl(${hue}, 50%, 90%)` : `hsl(${hue}, 45%, 93%)`,
                    borderLeft: isFriendGame
                      ? `4px dashed hsl(${hue}, 55%, ${isPlayoff ? 40 : 45}%)`
                      : `4px solid hsl(${hue}, 55%, ${isPlayoff ? 40 : 45}%)`,
                  }}
                >
                  <div className="px-2 py-1 h-full flex items-center overflow-hidden">
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-xs font-bold truncate leading-tight"
                        style={{ color: `hsl(${hue}, 45%, 25%)` }}
                      >
                        {label}
                      </div>
                      <div className="text-[11px] truncate leading-tight" style={{ color: `hsl(${hue}, 25%, 50%)` }}>
                        {cg.game.time} · {cg.game.rink}
                      </div>
                    </div>
                    {unresolved && (
                      <div
                        className="shrink-0 ml-1 text-lg font-bold opacity-40"
                        style={{ color: `hsl(${hue}, 45%, 35%)` }}
                      >
                        ?
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}

            {/* Empty state */}
            {dayGames.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-slate-400">No games {currentDay.full}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating "My Friends" filter button — above bottom nav */}
      {friendTeams.length > 0 && (
        <div className="absolute bottom-20 right-4 z-40">
          {/* Popup menu */}
          {showFilterMenu && (
            <div
              className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden min-w-[200px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setFriendFilter("off"); setShowFilterMenu(false); }}
                className={`w-full text-left px-4 py-3 text-sm font-medium border-b border-slate-100 active:bg-slate-50 ${
                  friendFilter === "off" ? "text-[var(--color-primary)] bg-blue-50/50" : "text-slate-700"
                }`}
              >
                My Kid Only
              </button>
              <button
                onClick={() => { setFriendFilter("near-my-rink"); setShowFilterMenu(false); }}
                className={`w-full text-left px-4 py-3 text-sm font-medium border-b border-slate-100 active:bg-slate-50 ${
                  friendFilter === "near-my-rink" ? "text-[var(--color-primary)] bg-blue-50/50" : "text-slate-700"
                }`}
              >
                Friends Near My Rink
              </button>
              <button
                onClick={() => { setFriendFilter("all-their-games"); setShowFilterMenu(false); }}
                className={`w-full text-left px-4 py-3 text-sm font-medium active:bg-slate-50 ${
                  friendFilter === "all-their-games" ? "text-[var(--color-primary)] bg-blue-50/50" : "text-slate-700"
                }`}
              >
                All Friends&apos; Games
              </button>
            </div>
          )}

          {/* FAB button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowFilterMenu((v) => !v); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-semibold transition-colors ${
              friendFilter !== "off"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {filterLabel}
          </button>
        </div>
      )}
    </div>
  );
}
