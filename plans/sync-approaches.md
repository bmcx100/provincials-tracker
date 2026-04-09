# Sync Approaches for Provincials

## Context

The provincials tracker currently has:
- Static schedule data in `src/data/schedule.json` (all games, teams, pools pre-loaded)
- Manual score entry via localStorage (users tap a game card → enter score)
- No backend, no database, no API calls
- Deployed on Vercel

We need to add the ability to automatically pull game results from the OWHA website once they start posting provincials scores.

**Tournament dates:** April 10-12, 2026

---

## Approach 1: Next.js API Route + Client Polling (Recommended)

### How it works
1. Add a Next.js API route (`/api/owha-sync`) that fetches from the OWHA JSON API server-side
2. The API route maps OWHA team names to our schedule.json team IDs
3. Admin page triggers sync manually or on a timer
4. Results are returned as a `Record<gameId, Score>` that gets merged into localStorage
5. All users benefit because standings/brackets recalculate from scores

### Architecture
```
[Admin Page] → POST /api/owha-sync
                  ↓
              Fetch OWHA API (paginated)
                  ↓
              Parse OwhaApiGame[] response
                  ↓
              Match teams by name (normName + fuzzy match)
                  ↓
              Map to schedule.json game IDs
                  ↓
              Return { scores: Record<gameId, Score>, matched: N, unmatched: string[] }
                  ↓
[Admin Page] → Preview results → Apply to localStorage
```

### Pros
- Simple — no database needed
- Works with existing localStorage-based score system
- Server-side fetching avoids CORS issues
- Admin can review matches before applying
- All existing standings/bracket logic works unchanged

### Cons
- Each user's device has independent localStorage — sync only applies to the device that runs it
- No real-time push to all users (they'd need to refresh)

### Enhancement: Broadcast via `schedule.json` rebuild
Instead of just updating localStorage, could update `schedule.json` to include scores as default values. This would require a rebuild/redeploy but would give all users the scores.

---

## Approach 2: Shared Score Store via Vercel KV / Edge Config

### How it works
1. API route fetches from OWHA and writes scores to Vercel KV (Redis)
2. Client reads from KV on page load as "official" scores
3. User manual entries override official scores (or vice versa)
4. All users see the same official scores

### Architecture
```
[Admin] → POST /api/owha-sync → OWHA API → Parse → Vercel KV
[Users] → GET /api/scores → Vercel KV → merge with localStorage
```

### Pros
- All users see same scores automatically
- No rebuild needed
- Real-time-ish (on page refresh)

### Cons
- Adds Vercel KV dependency (free tier: 256MB, 30K requests/day — plenty)
- Need to handle merge logic between official and manual scores
- More complex architecture for a 3-day tournament

---

## Approach 3: Static Rebuild Pipeline

### How it works
1. Script fetches from OWHA API
2. Writes scores into `schedule.json` (adding a `scores` field to games)
3. Commit and push → Vercel auto-deploys
4. All users get scores on next page load

### Architecture
```
[Cron or Manual] → fetch OWHA → update schedule.json → git push → Vercel deploy
```

### Pros
- Zero runtime infrastructure
- All users get the same data
- Simple and reliable

### Cons
- Deploy takes ~30-60 seconds per update
- Requires git access from wherever you run it
- Can't run from phone easily

---

## Approach 4: HTML Scraping Fallback

If the OWHA JSON API doesn't have a provincials endpoint (or uses a different pattern), fall back to HTML scraping:

1. Fetch the provincials division page HTML
2. Parse the `<tbody aria-live="polite">` table
3. Extract game IDs, team names, scores from table rows
4. Same mapping logic to match to schedule.json

This is the legacy approach from `stat-in-stand/app/api/owha-schedule/route.ts`.

---

## Recommended Implementation: Approach 1 + Admin UI

Given the constraints (3-day tournament, no database, already deployed on Vercel), Approach 1 is the best balance:

### What we build:
1. **`/api/owha-sync` route** — server-side OWHA fetcher
2. **`/admin` page** — trigger sync, see results, apply scores
3. **Team name mapping utility** — match OWHA names to schedule.json teams
4. **Score merge logic** — apply OWHA scores without overwriting manual corrections

### The OWHA URL Problem

We don't have the provincials URL yet. OWHA may not have created the division page. Options:

1. **DevTools discovery** — Once the provincials page exists on owha.on.ca, open it in DevTools and read the XHR calls to find the API URL pattern
2. **URL input on admin page** — Let the admin paste the OWHA division URL, and we extract the constants (CATID, DID) to construct the API URL
3. **Try known patterns** — Provincials might use:
   - `CATID=0` like playdowns (province-wide)
   - A specific DID that we discover from the OWHA site
   - Possibly same AID/SID as playdowns (3617/13359) or a new pair

### What we know about provincials:
- They're province-wide events (like playdowns, CATID=0)
- Each level (U11AA, U13A, etc.) would likely be a separate division (DID)
- Or there might be one big division with all levels, filtered by SDID
- The team names in the API will include `#TeamNumber` which we can match to our team IDs (e.g. "Barrie Sharks #120" → team ID "120-u11aa")

### Team Number Matching Strategy

Our schedule.json teams have IDs like `"120-u11aa"` where `120` is the team number. OWHA team names include `#120` (the team registration number). This gives us a reliable numeric match:

```typescript
// Extract #NNN from OWHA team name
const owhaNum = owhTeamName.match(/#(\d+)/)?.[1]
// Find matching team in our data
const match = teams.find(t => String(t.number) === owhaNum && t.levelId === currentLevel)
```

This is much more reliable than fuzzy name matching.

---

## Data Flow for Each Sync

```
1. Admin enters OWHA URL (or we have it pre-configured per level)
2. POST /api/owha-sync { url, levelId }
3. Server fetches OWHA games API (paginated)
4. For each OWHA game:
   a. Extract team numbers from HomeTeamName/AwayTeamName (#NNN)
   b. Find matching teams in schedule.json for this level
   c. If game.completed && scores exist:
      - Find the matching game in schedule.json by home/away team IDs
      - Return { gameId, score: { home, away } }
5. Return full results to admin page
6. Admin reviews and applies
7. Scores written to localStorage (or broadcast to all users via Approach 2)
```

---

## Sync Frequency During Tournament

- Round-robin games: every 30-60 minutes during game days
- Playoff games: every 15-30 minutes (higher stakes, faster updates wanted)
- Manual trigger always available
- Could add auto-refresh with configurable interval on admin page

---

## Implementation Priority

1. **Admin page with URL input and manual sync trigger** — essential
2. **API route for OWHA JSON API** — essential
3. **Team matching by number** — essential
4. **Score preview before apply** — nice to have
5. **Auto-refresh timer** — nice to have
6. **Level-specific sync** — nice to have (sync one level at a time vs. all)
