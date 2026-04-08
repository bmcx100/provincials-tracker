import { Game, Level, Score, Standing } from "./types";

/**
 * Calculate pool standings based on entered scores.
 * Points: W=2, T=1, L=0
 * Tiebreakers (OWHA rules):
 *  1. Total points
 *  2. Most wins
 *  3. Record against tied teams
 *  4. Goal difference (GF - GA)
 *  5. Fewest goals allowed
 *  6. Most periods won (not tracked — skipped)
 *  7. Fewest penalty minutes (not tracked — skipped)
 *  8. First goal scored (not tracked — skipped)
 *  9. Coin flip (not implemented)
 */
export function calculatePoolStandings(
  level: Level,
  poolId: string,
  scores: Record<string, Score>
): Standing[] {
  const pool = level.pools.find((p) => p.id === poolId);
  if (!pool) return [];

  const teamMap: Record<string, Standing> = {};
  for (const teamId of pool.teams) {
    const team = level.teams.find((t) => t.id === teamId);
    teamMap[teamId] = {
      teamId,
      teamName: team?.displayName ?? teamId,
      gp: 0,
      w: 0,
      l: 0,
      t: 0,
      pts: 0,
      gf: 0,
      ga: 0,
      gd: 0,
    };
  }

  // Process round-robin games for this pool
  const poolGames = level.games.filter(
    (g) => g.phase === "round-robin" && g.pool === poolId
  );

  for (const game of poolGames) {
    const score = scores[String(game.id)];
    if (!score) continue;
    if (!game.homeTeamId || !game.awayTeamId) continue;

    const home = teamMap[game.homeTeamId];
    const away = teamMap[game.awayTeamId];
    if (!home || !away) continue;

    home.gp++;
    away.gp++;
    home.gf += score.home;
    home.ga += score.away;
    away.gf += score.away;
    away.ga += score.home;

    if (score.home > score.away) {
      home.w++;
      home.pts += 2;
      away.l++;
    } else if (score.away > score.home) {
      away.w++;
      away.pts += 2;
      home.l++;
    } else {
      home.t++;
      away.t++;
      home.pts += 1;
      away.pts += 1;
    }
  }

  // Calculate GD
  const standings = Object.values(teamMap);
  for (const s of standings) {
    s.gd = s.gf - s.ga;
  }

  // Sort by tiebreakers
  standings.sort((a, b) => {
    // 1. Points
    if (b.pts !== a.pts) return b.pts - a.pts;
    // 2. Wins
    if (b.w !== a.w) return b.w - a.w;
    // 3. Head-to-head (compute on the fly)
    const h2h = headToHead(a.teamId, b.teamId, poolGames, scores);
    if (h2h !== 0) return -h2h; // positive = a wins h2h
    // 4. Goal difference
    if (b.gd !== a.gd) return b.gd - a.gd;
    // 5. Fewest goals allowed
    if (a.ga !== b.ga) return a.ga - b.ga;
    return 0;
  });

  return standings;
}

function headToHead(
  teamA: string,
  teamB: string,
  games: Game[],
  scores: Record<string, Score>
): number {
  let aPoints = 0;
  let bPoints = 0;

  for (const game of games) {
    const score = scores[String(game.id)];
    if (!score) continue;

    const isAHome = game.homeTeamId === teamA && game.awayTeamId === teamB;
    const isBHome = game.homeTeamId === teamB && game.awayTeamId === teamA;

    if (!isAHome && !isBHome) continue;

    const aGoals = isAHome ? score.home : score.away;
    const bGoals = isAHome ? score.away : score.home;

    if (aGoals > bGoals) aPoints += 2;
    else if (bGoals > aGoals) bPoints += 2;
    else {
      aPoints += 1;
      bPoints += 1;
    }
  }

  return aPoints - bPoints;
}

/**
 * For ranked formats (5pool, 6pool), rank all pool winners across pools.
 * Returns team IDs sorted by standing quality (best first).
 */
export function rankPoolWinners(
  level: Level,
  scores: Record<string, Score>
): string[] {
  const winners: { teamId: string; standing: Standing }[] = [];

  for (const pool of level.pools) {
    const standings = calculatePoolStandings(level, pool.id, scores);
    if (standings.length > 0 && standings[0].gp > 0) {
      winners.push({ teamId: standings[0].teamId, standing: standings[0] });
    }
  }

  // Sort pool winners by their stats (same tiebreaker logic)
  winners.sort((a, b) => {
    const sa = a.standing;
    const sb = b.standing;
    if (sb.pts !== sa.pts) return sb.pts - sa.pts;
    if (sb.w !== sa.w) return sb.w - sa.w;
    if (sb.gd !== sa.gd) return sb.gd - sa.gd;
    if (sa.ga !== sb.ga) return sa.ga - sb.ga;
    return 0;
  });

  return winners.map((w) => w.teamId);
}
