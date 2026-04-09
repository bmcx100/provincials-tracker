# OWHA Sync Research

## How stat-in-stand fetches game results from OWHA

Research from `/home/data/Documents/webapps/stat-in-stand/` — the existing project that syncs regular season, playoffs, and playdown games from the OWHA website.

---

## OWHA API Architecture

OWHA has **two separate API systems** depending on game type. All URLs are discovered via browser DevTools (Network → XHR) on the OWHA division page.

### API System 1: Regular Season + Playoffs (CATID != 0)

**Division page URL pattern:**
```
https://www.owha.on.ca/division/{CATID}/{DID}/games
```

**Games API:**
```
https://www.owha.on.ca/api/leaguegame/get/{AID}/{SID}/{CATID}/{DID}/{GTID}/{page}/
```

**Standings API:**
```
https://www.owha.on.ca/api/leaguegame/getstandings3cached/{AID}/{SID}/{GTID}/{CATID}/{DID}/0/0
```

**Known constants (2024-25 season):**
| Constant | Value | Notes |
|----------|-------|-------|
| AID | 2788 | OWHA Association ID — likely stable across seasons |
| SID | 12488 | Season ID — **changes each season**, must re-discover via DevTools |
| GTID | 5069 | Game Type ID for Regular Season |
| GTID | 5387 | Game Type ID for Playoffs |

### API System 2: Playdowns (CATID = 0 — provincial scope)

**Division page URL pattern:**
```
https://www.owha.on.ca/division/0/{DID}/games
```

**Games API:**
```
https://www.owha.on.ca/api/leaguegame/get/{AID}/{SID}/0/{DID}/0/{page}/
```

**Standings API:**
```
https://www.owha.on.ca/api/leaguegame/getstandings3wsdcached/{AID}/{SID}/0/0/{DID}/0
```

**Known constants (2024-25 season):**
| Constant | Value | Notes |
|----------|-------|-------|
| AID | 3617 | Different AID for playdowns — likely stable |
| SID | 13359 | Season ID for playdowns — **changes each season** |
| GTID | 0 | Playdowns always use 0 |

---

## How to Discover New URLs / Season IDs

This is critical — it's how we'll find the provincials URL:

1. Visit the OWHA division/event page in a browser (e.g. `https://www.owha.on.ca/division/0/27225/games`)
2. Open DevTools → Network tab → filter by XHR
3. Reload the page
4. Look for calls to `/api/leaguegame/get/...`
5. The URL segments reveal all the constants: `AID/SID/CATID/DID/GTID/page`

**For provincials specifically:**
- The tournament may appear as a new division page on OWHA with `CATID=0` (like playdowns) since it's province-wide
- OR it might use a completely different CATID if OWHA treats it as a distinct category
- The DID (Division ID) will be new and specific to the 2026 provincials
- We need to find this URL once OWHA posts the provincials schedule

---

## Request Headers (Required)

```typescript
const OWHA_FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/javascript, */*",
  "X-Requested-With": "XMLHttpRequest",
  "Referer": "https://www.owha.on.ca/",
}
```

All fetches use `cache: "no-store"` to bypass any CDN/edge caching.

---

## OWHA API Response Format

### Games API Response (`OwhaApiGame`)

The API returns a JSON array. Each game object:

```typescript
type OwhaApiGame = {
  GID: number | string       // Game ID (unique identifier)
  sDate: string              // "2025-10-05T15:00:00" or "2/15/2026 3:20:00 PM"
  ArenaName: string          // Rink/arena name
  HomeTeamName: string       // e.g. "Nepean Wildcats #2859"
  AwayTeamName: string       // e.g. "Barrie Sharks #120"
  HomeTID: number | string   // Home team OWHA ID
  AwayTID: number | string   // Away team OWHA ID
  homeScore: number | null   // null if not yet played
  awayScore: number | null
  completed: boolean         // true when game is final
  visible: boolean
  OT: boolean               // overtime
  SO: boolean               // shootout
  GameTypeName: string
}
```

### Standings API Response

Returns a JSON array with these fields per team:
- `TeamName` — string with `#TEAMID` suffix, sometimes age/level codes
- `GamesPlayed`, `Wins`, `Losses`, `Ties`, `OTL`, `SOL`, `Points`, `GF`, `GA`
- `SDID` — SubDivisionID (used for playdowns loop filtering)
- `SubDivName` — e.g. `"Region C (2 of 4 teams advance)"`
- `TID` — Team ID (TID=0 rows are region-label rows, should be filtered out)

### Pagination

Games API is paginated. Loop through pages 0-19, appending page number to URL:
```
{baseUrl}{page}/
```
An empty JSON array response signals no more pages.

---

## Team Name Matching

OWHA team names include noise that must be stripped for matching:

```typescript
function normName(s: string): string {
  return s
    .replace(/\([^)]*\)/g, "")   // strip parenthetical scores like "(3)"
    .replace(/#\d+/g, "")        // strip #TeamID
    .replace(/[^a-z0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim()
}
```

Matching uses bidirectional substring inclusion:
```typescript
function teamMatches(owhaN: string, org: string, name: string): boolean {
  const needle = normName(owhaN)
  const hayFull = normName(`${org} ${name}`)
  return needle === hayFull || needle.includes(hayFull) || hayFull.includes(needle)
}
```

**Important:** OWHA team names often include:
- `#TeamID` suffix (e.g. "Nepean Wildcats #2859")
- Age/level codes (e.g. "U15AA")
- Parenthetical scores in standings (e.g. "(3)")
- Registration codes (e.g. "NYH2103-017")

---

## Legacy HTML Scraping (Backup Approach)

The older approach in `owha-schedule/route.ts` fetches the raw HTML from the division page and parses it:

```typescript
// Fetch HTML
const res = await fetch("https://www.owha.on.ca/division/0/27225/games", {
  headers: { "User-Agent": "...", Accept: "text/html,application/xhtml+xml" },
  cache: "no-store",
})

// Parse the schedule table
const tbodyMatch = html.match(/<tbody[^>]*aria-live[^>]*>([\s\S]*?)<\/tbody>/)
// Extract <tr> rows with 5+ <td> cells
// Fields: gameId, date/notes (split by <br>), location (anchor text), home team, visitor team
// Scores parsed from "(N)" format at end of team name
```

This is a fallback if the JSON API doesn't work for provincials.

---

## Playdown-Specific Complexity (Relevant for Provincials)

Playdowns are the closest analogy to provincials in the existing system:

1. **Province-wide scope** — the API returns ALL games across all loops/divisions
2. **SDID filtering** — standings response includes `SDID` (SubDivisionID) to identify specific loops/groups
3. **Two-step process**: Must sync standings first (to discover team's SDID and loop teammates), then sync games (filtering by loop)
4. **Name-based filtering** — since HomeTID/AwayTID in games API don't match TID in standings API, filtering uses normalized team names

**For provincials**, we'll likely need similar logic:
- Fetch all games from the provincials division
- Match OWHA team names to our schedule.json teams
- Map scores to the correct game IDs

---

## Key Files in stat-in-stand

| File | Purpose |
|------|---------|
| `app/api/owha-sync/route.ts` | Main sync endpoint — handles regular, playoffs, playdowns, tournaments |
| `app/api/owha-schedule/route.ts` | Legacy HTML scraper (backup approach) |
| `lib/parsers.ts` | Text-paste parsers for OWHA, MHR, TeamSnap data |
| `lib/types.ts` | All TypeScript types including OwhaApiGame |
| `app/admin/sync/page.tsx` | Bulk sync UI for all teams |
| `app/admin/team/[slug]/page.tsx` | Per-team admin with sync buttons |
