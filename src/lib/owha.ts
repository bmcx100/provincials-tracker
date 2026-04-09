import schedule from "@/data/schedule.json";
import { Game, Level, Score } from "./types";

// ── OWHA API Constants ───────────────────────────────────────
// Discovered via DevTools on OWHA division pages.
// SID changes each season — these are 2024-25 values.
// If provincials uses a new AID/SID, update here or override via admin.

// Regular season / playoffs
const OWHA_REGULAR = { AID: 2788, SID: 12488, GTID_REGULAR: 5069, GTID_PLAYOFFS: 5387 };
// Playdowns / province-wide events
const OWHA_PLAYDOWNS = { AID: 3617, SID: 13359, GTID: 0 };

// Headers needed for OWHA API requests
const OWHA_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*",
  "X-Requested-With": "XMLHttpRequest",
  Referer: "https://www.owha.on.ca/",
};

// ── OWHA API Types ───────────────────────────────────────────

export type OwhaApiGame = {
  GID: number | string;
  sDate: string;
  ArenaName: string;
  HomeTeamName: string;
  AwayTeamName: string;
  HomeTID: number | string;
  AwayTID: number | string;
  homeScore: number | null;
  awayScore: number | null;
  completed: boolean;
  visible: boolean;
  OT: boolean;
  SO: boolean;
  GameTypeName: string;
};

export type SyncResult = {
  owhaGameId: string;
  homeTeamOwha: string;
  awayTeamOwha: string;
  homeTeamMatched: string | null; // our team ID
  awayTeamMatched: string | null;
  homeScore: number | null;
  awayScore: number | null;
  completed: boolean;
  matchedGameId: number | null; // our game ID from schedule.json
};

export type SyncResponse = {
  games: SyncResult[];
  summary: {
    total: number;
    completed: number;
    matched: number;
    unmatched: number;
    scores: Record<string, Score>;
  };
  error?: string;
  debug?: Record<string, unknown>;
};

// ── URL Parsing ──────────────────────────────────────────────

/**
 * Parse an OWHA division URL into its components.
 * URL format: https://www.owha.on.ca/division/{CATID}/{DID}/games
 */
export function parseDivisionUrl(url: string): { catId: string; divisionId: string } | null {
  const m = url.match(/\/division\/(\d+)\/(\d+)/);
  if (!m) return null;
  return { catId: m[1], divisionId: m[2] };
}

/**
 * Convert a division page URL to the OWHA games API base URL.
 * Appends {page}/ to paginate.
 */
export function toGamesApiUrl(
  url: string,
  overrides?: { aid?: number; sid?: number; gtid?: number }
): string {
  const parsed = parseDivisionUrl(url);
  if (!parsed) return url;
  const { catId, divisionId } = parsed;

  if (catId === "0") {
    // Province-wide event (playdowns, possibly provincials)
    const aid = overrides?.aid ?? OWHA_PLAYDOWNS.AID;
    const sid = overrides?.sid ?? OWHA_PLAYDOWNS.SID;
    const gtid = overrides?.gtid ?? OWHA_PLAYDOWNS.GTID;
    return `https://www.owha.on.ca/api/leaguegame/get/${aid}/${sid}/0/${divisionId}/${gtid}/`;
  }

  const aid = overrides?.aid ?? OWHA_REGULAR.AID;
  const sid = overrides?.sid ?? OWHA_REGULAR.SID;
  const gtid = overrides?.gtid ?? OWHA_REGULAR.GTID_REGULAR;
  return `https://www.owha.on.ca/api/leaguegame/get/${aid}/${sid}/${catId}/${divisionId}/${gtid}/`;
}

/**
 * Convert a division page URL to the OWHA standings API URL.
 */
export function toStandingsApiUrl(
  url: string,
  overrides?: { aid?: number; sid?: number; gtid?: number }
): string {
  const parsed = parseDivisionUrl(url);
  if (!parsed) return url;
  const { catId, divisionId } = parsed;

  if (catId === "0") {
    const aid = overrides?.aid ?? OWHA_PLAYDOWNS.AID;
    const sid = overrides?.sid ?? OWHA_PLAYDOWNS.SID;
    return `https://www.owha.on.ca/api/leaguegame/getstandings3wsdcached/${aid}/${sid}/0/0/${divisionId}/0`;
  }

  const aid = overrides?.aid ?? OWHA_REGULAR.AID;
  const sid = overrides?.sid ?? OWHA_REGULAR.SID;
  const gtid = overrides?.gtid ?? OWHA_REGULAR.GTID_REGULAR;
  return `https://www.owha.on.ca/api/leaguegame/getstandings3cached/${aid}/${sid}/${gtid}/${catId}/${divisionId}/0/0`;
}

// ── Fetching ─────────────────────────────────────────────────

/**
 * Fetch all pages from the OWHA games API.
 */
export async function fetchAllOwhaGames(baseUrl: string): Promise<OwhaApiGame[]> {
  const all: OwhaApiGame[] = [];
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  for (let page = 0; page < 20; page++) {
    const url = `${base}${page}/`;
    const res = await fetch(url, { headers: OWHA_FETCH_HEADERS, cache: "no-store" });

    if (!res.ok) {
      throw new Error(`OWHA API returned ${res.status} on page ${page}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
  }

  return all;
}

/**
 * Fetch the HTML page and scrape the schedule table (fallback).
 */
export async function scrapeOwhaHtml(
  url: string
): Promise<Array<{ id: string; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null }>> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`OWHA HTML returned ${res.status}`);
  const html = await res.text();

  const tbodyMatch = html.match(/<tbody[^>]*aria-live[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) throw new Error("Could not locate schedule table in OWHA HTML");

  const games: Array<{ id: string; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null }> = [];

  const stripTags = (s: string) =>
    s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/<[^>]+>/g, "").trim();

  const anchorText = (html: string) => {
    const m = html.match(/<a[^>]*>([\s\S]*?)<\/a>/);
    return m ? stripTags(m[1]) : stripTags(html);
  };

  const parseTeam = (raw: string) => {
    const m = raw.match(/^(.*?)\s+\((\d+)\)\s*$/);
    if (m) return { name: m[1].trim(), score: parseInt(m[2], 10) };
    return { name: raw.trim(), score: null };
  };

  for (const rowMatch of tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
    if (cells.length < 5) continue;

    const id = stripTags(cells[0]);
    const { name: homeTeam, score: homeScore } = parseTeam(anchorText(cells[3]));
    const { name: awayTeam, score: awayScore } = parseTeam(anchorText(cells[4]));

    games.push({ id, homeTeam, awayTeam, homeScore, awayScore });
  }

  return games;
}

// ── Team Matching ────────────────────────────────────────────

/**
 * Normalize a team name for matching (strip noise, lowercase).
 */
function normName(s: string): string {
  return s
    .replace(/\([^)]*\)/g, "")
    .replace(/#\d+/g, "")
    .replace(/[^a-z0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Extract the team registration number from an OWHA team name.
 * e.g. "Barrie Sharks #120" → "120"
 */
function extractTeamNumber(owhaName: string): string | null {
  const m = owhaName.match(/#(\d+)/);
  return m ? m[1] : null;
}

/**
 * Match an OWHA team name to our schedule.json teams.
 * Strategy:
 *   1. Match by team number (#NNN) + levelId — most reliable
 *   2. Fall back to fuzzy name matching
 */
export function matchOwhaTeam(
  owhaName: string,
  levelId?: string
): { teamId: string; team: { id: string; number: number; name: string; levelId: string } } | null {
  const levels = (schedule as { levels: Level[] }).levels;
  const searchLevels = levelId ? levels.filter((l) => l.id === levelId) : levels;

  // Strategy 1: Match by team number
  const num = extractTeamNumber(owhaName);
  if (num) {
    for (const level of searchLevels) {
      const team = level.teams.find((t) => String(t.number) === num);
      if (team) return { teamId: team.id, team: { ...team, levelId: level.id } };
    }
  }

  // Strategy 2: Fuzzy name match
  const needle = normName(owhaName);
  for (const level of searchLevels) {
    for (const team of level.teams) {
      const hay = normName(team.name);
      if (needle === hay || needle.includes(hay) || hay.includes(needle)) {
        return { teamId: team.id, team: { ...team, levelId: level.id } };
      }
    }
  }

  return null;
}

/**
 * Find the game in schedule.json that matches the two team IDs.
 * For round-robin games, matches by homeTeamId/awayTeamId.
 */
export function findMatchingGame(
  homeTeamId: string,
  awayTeamId: string,
  levelId: string
): Game | null {
  const levels = (schedule as { levels: Level[] }).levels;
  const level = levels.find((l) => l.id === levelId);
  if (!level) return null;

  // Try exact home/away match first
  const exact = level.games.find(
    (g) => g.homeTeamId === homeTeamId && g.awayTeamId === awayTeamId
  );
  if (exact) return exact;

  // Try reversed (OWHA might have home/away swapped)
  const reversed = level.games.find(
    (g) => g.homeTeamId === awayTeamId && g.awayTeamId === homeTeamId
  );
  return reversed ?? null;
}

// ── Date Parsing ─────────────────────────────────────────────

/**
 * Parse OWHA sDate format.
 * Can be "2025-10-05T15:00:00" or "4/10/2026 8:00:00 AM" or similar.
 */
export function parseSDate(sDate: string): { date: string; time: string } {
  if (!sDate) return { date: "", time: "" };

  // ISO format: "2025-10-05T15:00:00"
  if (sDate.includes("T")) {
    const [datePart, timePart] = sDate.split("T");
    return { date: datePart || "", time: timePart ? timePart.slice(0, 5) : "" };
  }

  // US format: "4/10/2026 8:00:00 AM"
  const parts = sDate.split(" ");
  if (parts.length >= 2) {
    const datePart = parts[0]; // "4/10/2026"
    const timePart = parts[1]; // "8:00:00"
    const ampm = parts[2]; // "AM" or "PM"
    const [h, m] = timePart.split(":");
    let hour = parseInt(h);
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return {
      date: datePart,
      time: `${String(hour).padStart(2, "0")}:${m}`,
    };
  }

  return { date: sDate, time: "" };
}
