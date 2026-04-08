import { Game, Level, Score, TeamRef } from "./types";
import { calculatePoolStandings, rankPoolWinners } from "./standings";

/**
 * Resolve a playoff team reference to an actual team ID (or null if unresolved).
 */
export function resolveParticipant(
  ref: TeamRef,
  level: Level,
  scores: Record<string, Score>
): string | null {
  switch (ref.type) {
    case "pool-rank": {
      if (ref.pool) {
        // 8-pool QF format: ref specifies a specific pool
        const standings = calculatePoolStandings(level, ref.pool, scores);
        const entry = standings[ref.rank - 1];
        return entry?.gp > 0 ? entry.teamId : null;
      } else {
        // Ranked format (5pool/6pool): rank among all pool winners
        const ranked = rankPoolWinners(level, scores);
        return ranked[ref.rank - 1] ?? null;
      }
    }
    case "game-winner": {
      const game = level.games.find((g) => g.id === ref.gameId);
      if (!game) return null;
      const score = scores[String(ref.gameId)];
      if (!score) return null;

      // Determine who played
      const homeId = game.homeTeamId ?? resolveParticipant(game.homeRef!, level, scores);
      const awayId = game.awayTeamId ?? resolveParticipant(game.awayRef!, level, scores);
      if (!homeId || !awayId) return null;

      if (score.home > score.away) return homeId;
      if (score.away > score.home) return awayId;
      return null; // tie in playoff shouldn't happen, but handle gracefully
    }
    case "game-loser": {
      const game = level.games.find((g) => g.id === ref.gameId);
      if (!game) return null;
      const score = scores[String(ref.gameId)];
      if (!score) return null;

      const homeId = game.homeTeamId ?? resolveParticipant(game.homeRef!, level, scores);
      const awayId = game.awayTeamId ?? resolveParticipant(game.awayRef!, level, scores);
      if (!homeId || !awayId) return null;

      if (score.home > score.away) return awayId;
      if (score.away > score.home) return homeId;
      return null;
    }
  }
}

export interface BracketGame {
  game: Game;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  score: Score | null;
}

/**
 * Build the bracket data for a level's playoff games.
 */
export function buildBracket(
  level: Level,
  scores: Record<string, Score>
): BracketGame[] {
  const playoffGames = level.games.filter((g) => g.phase !== "round-robin");

  return playoffGames.map((game) => {
    const homeId = game.homeRef
      ? resolveParticipant(game.homeRef, level, scores)
      : game.homeTeamId ?? null;
    const awayId = game.awayRef
      ? resolveParticipant(game.awayRef, level, scores)
      : game.awayTeamId ?? null;

    const homeTeam = homeId ? level.teams.find((t) => t.id === homeId) : null;
    const awayTeam = awayId ? level.teams.find((t) => t.id === awayId) : null;

    return {
      game,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeTeamName: homeTeam?.displayName ?? describeRef(game.homeRef),
      awayTeamName: awayTeam?.displayName ?? describeRef(game.awayRef),
      score: scores[String(game.id)] ?? null,
    };
  });
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
