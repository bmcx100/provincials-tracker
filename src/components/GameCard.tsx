"use client";

import { Game, Team, Score } from "@/lib/types";

interface GameCardProps {
  game: Game;
  teams: Team[];
  score?: Score;
  onScoreTap: (game: Game) => void;
  highlightTeamIds?: string[];
  compact?: boolean;
}

export default function GameCard({
  game,
  teams,
  score,
  onScoreTap,
  highlightTeamIds = [],
  compact = false,
}: GameCardProps) {
  const homeTeam = game.homeTeamId
    ? teams.find((t) => t.id === game.homeTeamId)
    : null;
  const awayTeam = game.awayTeamId
    ? teams.find((t) => t.id === game.awayTeamId)
    : null;

  const homeName = homeTeam?.displayName ?? "TBD";
  const awayName = awayTeam?.displayName ?? "TBD";

  const homeHighlight = homeTeam && highlightTeamIds.includes(homeTeam.id);
  const awayHighlight = awayTeam && highlightTeamIds.includes(awayTeam.id);

  const phaseLabel =
    game.phase === "round-robin"
      ? game.pool
        ? `Pool ${game.pool}`
        : "RR"
      : game.phase
          .split("-")
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" ");

  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 overflow-hidden ${
        compact ? "p-2" : "p-3"
      }`}
    >
      {/* Header: time, rink, phase */}
      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
        <span className="font-medium">
          {game.time} — {game.rink}
        </span>
        <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide">
          {phaseLabel}
        </span>
      </div>

      {/* Matchup */}
      <button
        onClick={() => onScoreTap(game)}
        className="w-full active:bg-slate-50 rounded transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          {/* Home */}
          <div className="flex-1 text-left">
            <span
              className={`text-sm leading-tight ${
                homeHighlight ? "font-bold text-[var(--color-primary)]" : ""
              }`}
            >
              {homeName}
            </span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-1 min-w-[60px] justify-center">
            {score ? (
              <span className="font-mono font-bold text-base">
                {score.home} - {score.away}
              </span>
            ) : (
              <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded">
                vs
              </span>
            )}
          </div>

          {/* Away */}
          <div className="flex-1 text-right">
            <span
              className={`text-sm leading-tight ${
                awayHighlight ? "font-bold text-[var(--color-primary)]" : ""
              }`}
            >
              {awayName}
            </span>
          </div>
        </div>
      </button>

      {/* Game number */}
      <div className="text-[10px] text-slate-400 mt-1 text-center">
        Game #{game.id}
      </div>
    </div>
  );
}
