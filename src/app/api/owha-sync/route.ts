import { NextResponse } from "next/server";
import {
  getProvincialsSyncUrl,
  toGamesApiUrl,
  fetchAllOwhaGames,
  scrapeOwhaHtml,
  matchOwhaTeam,
  findMatchingGame,
  parseSDate,
  type OwhaApiGame,
  type SyncResult,
  type SyncResponse,
} from "@/lib/owha";
import { Score } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url: rawUrl, levelId, mode, overrides } = body as {
      url?: string;
      levelId?: string;
      mode?: "json" | "html" | "auto";
      overrides?: { aid?: number; sid?: number; gtid?: number };
    };

    // Build URL from levelId if no explicit URL provided
    const url = rawUrl || (levelId ? getProvincialsSyncUrl(levelId) : null);

    if (!url) {
      return NextResponse.json({ error: "url or levelId is required" }, { status: 400 });
    }

    const syncMode = mode ?? "auto";
    const debug: Record<string, unknown> = { url, levelId, mode: syncMode };

    // ── Try JSON API first ───────────────────────────────
    let owhaGames: OwhaApiGame[] = [];
    let usedMethod: "json" | "html" = "json";

    if (syncMode === "json" || syncMode === "auto") {
      try {
        // If we already have a direct API URL (from getProvincialsSyncUrl), use it as-is
        const apiUrl = rawUrl ? toGamesApiUrl(rawUrl, overrides) : url;
        debug.apiUrl = apiUrl;
        owhaGames = await fetchAllOwhaGames(apiUrl);
        debug.jsonGamesFound = owhaGames.length;
      } catch (err) {
        debug.jsonError = String(err);
        if (syncMode === "json") {
          return NextResponse.json(
            { error: `JSON API failed: ${err}`, debug } as SyncResponse,
            { status: 502 }
          );
        }
        // Fall through to HTML scraping in auto mode
      }
    }

    // ── Fall back to HTML scraping ───────────────────────
    if (owhaGames.length === 0 && (syncMode === "html" || syncMode === "auto")) {
      try {
        usedMethod = "html";
        const scraped = await scrapeOwhaHtml(url);
        debug.htmlGamesFound = scraped.length;

        // Convert HTML results to a compatible format for processing
        const results: SyncResult[] = [];
        const scores: Record<string, Score> = {};

        for (const g of scraped) {
          const homeMatch = matchOwhaTeam(g.homeTeam, levelId);
          const awayMatch = matchOwhaTeam(g.awayTeam, levelId);
          const completed = g.homeScore !== null && g.awayScore !== null;

          let matchedGameId: number | null = null;
          if (homeMatch && awayMatch) {
            const game = findMatchingGame(homeMatch.teamId, awayMatch.teamId, homeMatch.team.levelId);
            if (game) {
              matchedGameId = game.id;
              if (completed) {
                // Determine if scores need flipping (if we matched reversed)
                const isReversed = game.homeTeamId === awayMatch.teamId;
                scores[String(game.id)] = isReversed
                  ? { home: g.awayScore!, away: g.homeScore! }
                  : { home: g.homeScore!, away: g.awayScore! };
              }
            }
          }

          results.push({
            owhaGameId: g.id,
            homeTeamOwha: g.homeTeam,
            awayTeamOwha: g.awayTeam,
            homeTeamMatched: homeMatch?.teamId ?? null,
            awayTeamMatched: awayMatch?.teamId ?? null,
            homeScore: g.homeScore,
            awayScore: g.awayScore,
            completed,
            matchedGameId,
          });
        }

        const matched = results.filter((r) => r.matchedGameId !== null).length;
        return NextResponse.json({
          games: results,
          summary: {
            total: results.length,
            completed: results.filter((r) => r.completed).length,
            matched,
            unmatched: results.length - matched,
            scores,
          },
          debug: { ...debug, method: "html" },
        } satisfies SyncResponse);
      } catch (err) {
        debug.htmlError = String(err);
        return NextResponse.json(
          { error: `Both JSON and HTML methods failed. HTML: ${err}`, debug } as unknown as SyncResponse,
          { status: 502 }
        );
      }
    }

    if (owhaGames.length === 0) {
      return NextResponse.json(
        {
          games: [],
          summary: { total: 0, completed: 0, matched: 0, unmatched: 0, scores: {} },
          debug: { ...debug, method: usedMethod, note: "No games returned from OWHA" },
        } satisfies SyncResponse
      );
    }

    // ── Process JSON API results ─────────────────────────
    const results: SyncResult[] = [];
    const scores: Record<string, Score> = {};

    for (const g of owhaGames) {
      const homeMatch = matchOwhaTeam(g.HomeTeamName, levelId);
      const awayMatch = matchOwhaTeam(g.AwayTeamName, levelId);
      const completed = g.completed === true && g.homeScore !== null && g.awayScore !== null;

      let matchedGameId: number | null = null;
      if (homeMatch && awayMatch) {
        const game = findMatchingGame(homeMatch.teamId, awayMatch.teamId, homeMatch.team.levelId);
        if (game) {
          matchedGameId = game.id;
          if (completed) {
            const isReversed = game.homeTeamId === awayMatch.teamId;
            scores[String(game.id)] = isReversed
              ? { home: g.awayScore!, away: g.homeScore! }
              : { home: g.homeScore!, away: g.awayScore! };
          }
        }
      }

      results.push({
        owhaGameId: String(g.GID),
        homeTeamOwha: g.HomeTeamName,
        awayTeamOwha: g.AwayTeamName,
        homeTeamMatched: homeMatch?.teamId ?? null,
        awayTeamMatched: awayMatch?.teamId ?? null,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        completed,
        matchedGameId,
      });
    }

    const matched = results.filter((r) => r.matchedGameId !== null).length;

    // Collect sample unmatched team names for debugging
    const unmatchedNames = new Set<string>();
    for (const r of results) {
      if (!r.homeTeamMatched) unmatchedNames.add(r.homeTeamOwha);
      if (!r.awayTeamMatched) unmatchedNames.add(r.awayTeamOwha);
    }
    if (unmatchedNames.size > 0) {
      debug.unmatchedTeamNames = [...unmatchedNames].slice(0, 20);
    }

    return NextResponse.json({
      games: results,
      summary: {
        total: results.length,
        completed: results.filter((r) => r.completed).length,
        matched,
        unmatched: results.length - matched,
        scores,
      },
      debug: { ...debug, method: "json" },
    } satisfies SyncResponse);
  } catch (err) {
    return NextResponse.json(
      { error: `Unexpected error: ${err}` } as unknown as SyncResponse,
      { status: 500 }
    );
  }
}
