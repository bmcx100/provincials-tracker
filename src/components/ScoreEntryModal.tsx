"use client";

import { useState, useEffect, useRef } from "react";
import { Game, Team, Score } from "@/lib/types";
import { getRanking } from "@/data/rankings";

interface ScoreEntryModalProps {
  game: Game | null;
  teams: Team[];
  currentScore?: Score;
  onSave: (gameId: number, score: Score) => void;
  onClear: (gameId: number) => void;
  onClose: () => void;
}

export default function ScoreEntryModal({
  game,
  teams,
  currentScore,
  onSave,
  onClear,
  onClose,
}: ScoreEntryModalProps) {
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const homeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (game) {
      setHomeScore(currentScore ? String(currentScore.home) : "");
      setAwayScore(currentScore ? String(currentScore.away) : "");
      // Focus after a tick to allow animation
      setTimeout(() => homeInputRef.current?.focus(), 100);
    }
  }, [game, currentScore]);

  if (!game) return null;

  const homeTeam = game.homeTeamId
    ? teams.find((t) => t.id === game.homeTeamId)
    : null;
  const awayTeam = game.awayTeamId
    ? teams.find((t) => t.id === game.awayTeamId)
    : null;

  const handleSave = () => {
    const h = parseInt(homeScore);
    const a = parseInt(awayScore);
    if (!isNaN(h) && !isNaN(a) && h >= 0 && a >= 0) {
      onSave(game.id, { home: h, away: a });
      onClose();
    }
  };

  const handleClear = () => {
    onClear(game.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8 animate-slide-up">
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />

        <h3 className="text-sm font-semibold text-slate-500 text-center mb-1">
          Game #{game.id} — {game.time}
        </h3>
        <p className="text-xs text-slate-400 text-center mb-4">{game.rink}</p>

        <div className="flex items-center gap-4">
          {/* Home team */}
          <div className="flex-1 text-center">
            <p className="text-sm font-medium mb-2 truncate">
              {homeTeam?.displayName ?? "TBD"}
              {homeTeam && (() => {
                const r = getRanking(homeTeam.levelId, homeTeam.name);
                return r ? ` (#${r.rank})` : "";
              })()}
            </p>
            <input
              ref={homeInputRef}
              type="number"
              inputMode="numeric"
              min="0"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              className="w-20 h-14 mx-auto text-center text-2xl font-bold border-2 border-slate-300 rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
              placeholder="0"
            />
          </div>

          <span className="text-slate-400 text-lg font-bold mt-6">—</span>

          {/* Away team */}
          <div className="flex-1 text-center">
            <p className="text-sm font-medium mb-2 truncate">
              {awayTeam?.displayName ?? "TBD"}
              {awayTeam && (() => {
                const r = getRanking(awayTeam.levelId, awayTeam.name);
                return r ? ` (#${r.rank})` : "";
              })()}
            </p>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-20 h-14 mx-auto text-center text-2xl font-bold border-2 border-slate-300 rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          {currentScore && (
            <button
              onClick={handleClear}
              className="flex-1 h-12 rounded-lg border border-red-200 text-red-600 text-sm font-medium active:bg-red-50"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex-1 h-12 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold active:bg-[var(--color-primary-light)]"
          >
            Save Score
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
