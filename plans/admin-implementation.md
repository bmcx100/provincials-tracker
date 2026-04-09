# Admin Route Implementation Plan

## Overview

Create an `/admin` route in the provincials tracker where the tournament operator can:
1. Configure the OWHA URL(s) for provincials
2. Trigger a sync to fetch game results from OWHA
3. See sync progress and results
4. Preview matched scores before applying them
5. Apply scores to the app (writes to a shared mechanism)

## Route Structure

```
/admin                  — Main admin page (sync controls + status)
/api/owha-sync          — Server-side API route to fetch from OWHA
```

The admin page is NOT linked from the bottom nav — accessed directly by URL only.

## Admin Page Features

### Section 1: OWHA Configuration
- Input field to paste the OWHA division URL for provincials
- Dropdown or tabs to select which level to sync (U11AA, U13A, etc.)
- Option to configure a URL per level or one URL for all
- Save button stores config in localStorage under `prov-admin-config`

### Section 2: Sync Controls
- "Sync Now" button per level (or "Sync All" for everything)
- Auto-refresh toggle with interval selector (15s / 30s / 60s)
- Last synced timestamp display

### Section 3: Sync Results
- Table showing: Game #, Home Team, Away Team, Score, Status (new/updated/unchanged/unmatched)
- Color coding: green = new score found, yellow = score updated, gray = unchanged, red = unmatched team
- Count summary: "Found 24 completed games, 18 matched, 6 unmatched"

### Section 4: Score Application
- "Apply All Scores" button
- "Apply Level" per-level buttons
- Preview diff: shows what will change in current scores

## API Route: `/api/owha-sync`

### Request
```typescript
POST /api/owha-sync
{
  url: string,           // OWHA division page URL
  levelId?: string,      // optional: filter to specific level
}
```

### Response
```typescript
{
  games: Array<{
    owhaGameId: string,
    homeTeamOwha: string,   // raw OWHA name
    awayTeamOwha: string,
    homeTeamMatched: string | null,  // our team ID
    awayTeamMatched: string | null,
    homeScore: number | null,
    awayScore: number | null,
    completed: boolean,
    matchedGameId: number | null,  // our game ID from schedule.json
  }>,
  summary: {
    total: number,
    completed: number,
    matched: number,
    unmatched: number,
  }
}
```

### Implementation Details

The API route will:
1. Parse the OWHA URL to extract CATID and DID
2. Try the JSON API first (using constants from stat-in-stand research)
3. Fall back to HTML scraping if JSON API fails
4. Paginate through all games
5. Match teams by extracting `#NNN` from team names and comparing to schedule.json team numbers
6. Return results for the admin to review

### OWHA Constants to Try

Since we don't know the exact provincials API parameters yet, the admin page includes a "Discovery Mode" that:
1. Fetches the HTML page first
2. Looks for embedded JavaScript that reveals the API constants
3. Tries known AID/SID combinations
4. Falls back to HTML table parsing

**Known constants from 2024-25 season:**
- Regular: AID=2788, SID=12488
- Playdowns: AID=3617, SID=13359
- Provincials might use either set, or a new one entirely

## Score Storage Architecture

### Option A: localStorage only (simplest)
Scores stored in `prov-scores` key. Admin syncs on their phone → only their phone gets scores. Other users enter manually.

### Option B: Score file in public/ (implemented)
Admin sync writes scores to a JSON file served statically. All users fetch this file periodically. Requires a way to update the file (Vercel deploy or KV store).

### Chosen: localStorage + optional broadcast
- Admin runs sync on their device
- Scores saved to localStorage immediately
- Future enhancement: share scores via URL parameter or QR code

## File Changes

### New files:
- `src/app/admin/page.tsx` — Admin dashboard
- `src/app/api/owha-sync/route.ts` — OWHA fetch endpoint
- `src/lib/owha.ts` — OWHA API utilities (constants, URL conversion, team matching)

### Modified files:
- None (admin page is standalone, not linked from nav)

## Security

The admin page has no authentication — it's a tournament-day tool. Security through obscurity (URL not linked). The API route only reads from OWHA (no writes to external services). Worst case: someone finds /admin and syncs scores, which is... helpful.

## Mobile-First Design

The admin page should work on a phone at the rink:
- Large tap targets for sync buttons
- Clear status indicators (green/yellow/red dots)
- Minimal scrolling needed for common actions
- Auto-refresh so you can leave it open
