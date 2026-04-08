"use client";

import { useParams } from "next/navigation";
import schedule from "@/data/schedule.json";
import { useUserPrefs } from "@/context/UserPrefsContext";
import { Level, Schedule, Game } from "@/lib/types";
import { buildBracket, BracketGame } from "@/lib/bracket";
import Link from "next/link";

const data = schedule as Schedule;

function BracketGameCard({ bg, trackedTeams }: { bg: BracketGame; trackedTeams: string[] }) {
  const homeHighlight = bg.homeTeamId && trackedTeams.includes(bg.homeTeamId);
  const awayHighlight = bg.awayTeamId && trackedTeams.includes(bg.awayTeamId);
  const homeWon = bg.score && bg.score.home > bg.score.away;
  const awayWon = bg.score && bg.score.away > bg.score.home;

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden min-w-[200px]">
      {/* Phase label */}
      <div className="bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
        {bg.game.phase.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")}
      </div>

      {/* Home */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-slate-100 ${
        homeWon ? "bg-green-50" : ""
      }`}>
        <span className={`text-sm truncate flex-1 ${
          homeHighlight ? "font-bold text-[var(--color-primary)]" : ""
        } ${!bg.homeTeamId ? "text-slate-400 italic" : ""}`}>
          {bg.homeTeamName}
        </span>
        <span className={`font-mono font-bold text-sm ml-2 ${homeWon ? "text-green-700" : ""}`}>
          {bg.score ? bg.score.home : ""}
        </span>
      </div>

      {/* Away */}
      <div className={`flex items-center justify-between px-3 py-2 ${
        awayWon ? "bg-green-50" : ""
      }`}>
        <span className={`text-sm truncate flex-1 ${
          awayHighlight ? "font-bold text-[var(--color-primary)]" : ""
        } ${!bg.awayTeamId ? "text-slate-400 italic" : ""}`}>
          {bg.awayTeamName}
        </span>
        <span className={`font-mono font-bold text-sm ml-2 ${awayWon ? "text-green-700" : ""}`}>
          {bg.score ? bg.score.away : ""}
        </span>
      </div>

      {/* Game info */}
      <div className="px-3 py-1 text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100">
        Game #{bg.game.id} · {bg.game.time} · {bg.game.rink}
      </div>
    </div>
  );
}

export default function BracketPage() {
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

  const bracketGames = buildBracket(level as Level, scores);

  // Group by phase
  const phases: Record<string, BracketGame[]> = {};
  for (const bg of bracketGames) {
    const phase = bg.game.phase;
    if (!phases[phase]) phases[phase] = [];
    phases[phase].push(bg);
  }

  const phaseOrder = ["quarter-final", "semi-final", "gold-medal", "bronze-medal"];
  const sortedPhases = phaseOrder.filter((p) => phases[p]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <Link href={`/level/${levelId}`} className="text-xs text-slate-500 hover:text-slate-700">
        &larr; {level.name}
      </Link>
      <h1 className="text-xl font-bold mb-1">{level.name} Bracket</h1>
      <p className="text-xs text-slate-500 mb-4">
        {level.playoffFormat === "8pool-qf" && "QF → SF → Gold/Bronze"}
        {level.playoffFormat === "4pool-no-qf" && "SF → Gold/Bronze"}
        {level.playoffFormat === "5pool-ranked" && "Play-in → SF → Gold/Bronze (pool winners ranked 1-5)"}
        {level.playoffFormat === "6pool-ranked" && "QF → SF → Gold/Bronze (pool winners ranked 1-6)"}
      </p>

      <div className="space-y-6">
        {sortedPhases.map((phase) => (
          <div key={phase}>
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
              {phase.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {phases[phase].map((bg) => (
                <BracketGameCard
                  key={bg.game.id}
                  bg={bg}
                  trackedTeams={trackedTeams}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {bracketGames.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">
          No playoff games found for this level.
        </p>
      )}
    </div>
  );
}
