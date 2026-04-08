#!/usr/bin/env python3
"""
Process raw NotebookLM JSON extracts into a unified schedule.json for the app.
Reads from data/raw/*.json, outputs to src/data/schedule.json
"""

import json
import os
import re
import sys

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
OUT_FILE = os.path.join(os.path.dirname(__file__), "..", "src", "data", "schedule.json")

LEVEL_ORDER = [
    "u11aa", "u13c", "u13b", "u13bb", "u13a", "u13aa",
    "u15c", "u15b", "u15bb", "u15a", "u15aa",
    "u18c", "u18b", "u18bb"
]

PLAYOFF_FORMATS = {
    "u11aa": "5pool-ranked",
    "u13c": "4pool-no-qf",
    "u13b": "8pool-qf",
    "u13bb": "8pool-qf",
    "u13a": "8pool-qf",
    "u13aa": "8pool-qf",
    "u15c": "4pool-no-qf",
    "u15b": "8pool-qf",
    "u15bb": "8pool-qf",
    "u15a": "8pool-qf",
    "u15aa": "8pool-qf",
    "u18c": "6pool-ranked",
    "u18b": "8pool-qf",
    "u18bb": "8pool-qf",
}


def extract_json_from_answer(raw):
    """Extract the JSON object from a NotebookLM --json response."""
    if "answer" in raw:
        answer = raw["answer"]
    else:
        answer = json.dumps(raw)

    # Find JSON block in markdown code fence
    match = re.search(r"```json\s*\n(.*?)\n```", answer, re.DOTALL)
    if match:
        return json.loads(match.group(1))

    # Try parsing answer directly
    try:
        return json.loads(answer)
    except json.JSONDecodeError:
        return None


def make_team_id(number, level_id):
    return f"{number}-{level_id}"


def make_display_name(name, number, level_id, all_teams_in_level):
    """Create display name. Add number suffix if same org appears multiple times in level."""
    same_name = [t for t in all_teams_in_level if t["name"] == name]
    if len(same_name) > 1:
        return f"{name} #{number}"
    return name


def process_level(level_id, raw_data, playoff_format):
    data = extract_json_from_answer(raw_data)
    if not data:
        print(f"ERROR: Could not parse {level_id}", file=sys.stderr)
        return None

    level_name = level_id.upper()
    all_raw_teams = []
    for pool in data["pools"]:
        for team in pool["teams"]:
            all_raw_teams.append(team)

    # Build teams
    teams = []
    for pool in data["pools"]:
        for team in pool["teams"]:
            tid = make_team_id(team["number"], level_id)
            display = make_display_name(team["name"], team["number"], level_id, all_raw_teams)
            teams.append({
                "id": tid,
                "number": team["number"],
                "name": team["name"],
                "displayName": display,
                "pool": pool["id"],
                "levelId": level_id,
            })

    # Build pools
    pools = []
    for pool in data["pools"]:
        pools.append({
            "id": pool["id"],
            "teams": [make_team_id(t["number"], level_id) for t in pool["teams"]],
        })

    # Build games
    games = []

    # Round-robin games
    for g in data.get("games", []):
        games.append({
            "id": g["game"],
            "levelId": level_id,
            "day": g["day"],
            "date": g["date"],
            "time": g["time"],
            "rink": g["rink"],
            "phase": "round-robin",
            "pool": g.get("pool"),
            "homeTeamId": make_team_id(g["home"], level_id),
            "awayTeamId": make_team_id(g["away"], level_id),
        })

    # Playoff games
    for g in data.get("playoffs", []):
        playoff_game = {
            "id": g["game"],
            "levelId": level_id,
            "day": g["day"],
            "date": g["date"],
            "time": g["time"],
            "rink": g["rink"],
            "phase": g["phase"],
        }

        # Parse refs from the raw data if available, otherwise from matchup text
        if "homeRef" in g:
            playoff_game["homeRef"] = g["homeRef"]
            playoff_game["awayRef"] = g["awayRef"]
        else:
            refs = parse_matchup_refs(g.get("matchup", ""), playoff_format, pools)
            playoff_game["homeRef"] = refs[0]
            playoff_game["awayRef"] = refs[1]

        games.append(playoff_game)

    return {
        "id": level_id,
        "name": level_name,
        "pools": pools,
        "teams": teams,
        "games": games,
        "playoffFormat": playoff_format,
    }


def parse_matchup_refs(matchup, playoff_format, pools):
    """Parse matchup text like '1st of Pool A vs 1st of Pool D' into refs."""
    parts = matchup.split(" vs ")
    if len(parts) != 2:
        parts = matchup.split(" (Home) vs ")
        if len(parts) == 2:
            parts[1] = parts[1].replace(" (Away)", "")
        else:
            return [{"type": "pool-rank", "rank": 1}, {"type": "pool-rank", "rank": 2}]

    refs = []
    for part in parts:
        part = part.strip().replace("(Home)", "").replace("(Away)", "").strip()
        ref = parse_single_ref(part, playoff_format, pools)
        refs.append(ref)

    return refs


def parse_single_ref(text, playoff_format, pools):
    # "Winner # 1234" or "Winner #1234"
    m = re.match(r"Winner\s*#?\s*(\d+)", text)
    if m:
        return {"type": "game-winner", "gameId": int(m.group(1))}

    # "Loser # 1234"
    m = re.match(r"Loser\s*#?\s*(\d+)", text)
    if m:
        return {"type": "game-loser", "gameId": int(m.group(1))}

    # "1st of Pool A" (8-pool QF)
    m = re.match(r"1st of Pool\s+([A-H])", text)
    if m:
        return {"type": "pool-rank", "pool": m.group(1), "rank": 1}

    # "Xth of 1st Place Teams" (ranked format)
    m = re.match(r"(\d+)(?:st|nd|rd|th) of 1st Place Teams", text)
    if m:
        return {"type": "pool-rank", "rank": int(m.group(1))}

    # Fallback
    return {"type": "pool-rank", "rank": 1}


def main():
    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)

    levels = []
    missing = []

    for level_id in LEVEL_ORDER:
        raw_file = os.path.join(RAW_DIR, f"{level_id}.json")
        if not os.path.exists(raw_file):
            missing.append(level_id)
            continue

        with open(raw_file) as f:
            raw = json.load(f)

        # Check if it's a pre-processed file (has "pools" at top level)
        # or a NotebookLM response (has "answer" key)
        if "answer" in raw:
            result = process_level(level_id, raw, PLAYOFF_FORMATS[level_id])
        else:
            # Already structured (manually saved earlier)
            result = process_level(level_id, {"answer": json.dumps(raw)}, PLAYOFF_FORMATS[level_id])

        if result:
            levels.append(result)
            team_count = len(result["teams"])
            game_count = len(result["games"])
            print(f"  {level_id.upper():8s}: {team_count:2d} teams, {game_count:2d} games")
        else:
            missing.append(level_id)

    if missing:
        print(f"\nMISSING: {', '.join(missing)}", file=sys.stderr)

    schedule = {"levels": levels}

    with open(OUT_FILE, "w") as f:
        json.dump(schedule, f, indent=2)

    total_teams = sum(len(l["teams"]) for l in levels)
    total_games = sum(len(l["games"]) for l in levels)
    print(f"\nWrote {OUT_FILE}")
    print(f"  {len(levels)} levels, {total_teams} teams, {total_games} games")


if __name__ == "__main__":
    main()
