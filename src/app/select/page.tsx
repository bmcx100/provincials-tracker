"use client";

import { useState, useMemo } from "react";
import Fuse from "fuse.js";
import schedule from "@/data/schedule.json";
import { useUserPrefs } from "@/context/UserPrefsContext";
import { Team, Schedule } from "@/lib/types";
import Link from "next/link";

const data = schedule as Schedule;

// Flatten all teams across all levels
const allTeams: Team[] = data.levels.flatMap((level) => level.teams as Team[]);

const fuse = new Fuse(allTeams, {
  keys: ["name", "displayName", "number", "levelId"],
  threshold: 0.35,
  includeScore: true,
});

export default function SelectPage() {
  const { myTeam, friendTeams, hydrated, setMyTeam, addFriendTeam, removeFriendTeam } =
    useUserPrefs();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query).slice(0, 20);
  }, [query]);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  const myTeamObj = myTeam ? allTeams.find((t) => t.id === myTeam) : null;
  const friendTeamObjs = friendTeams
    .map((id) => allTeams.find((t) => t.id === id))
    .filter(Boolean) as Team[];

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-1">My Teams</h1>
      <p className="text-sm text-slate-500 mb-4">
        Pick your team and add friends&apos; teams to track.
      </p>

      {/* Current selections */}
      {myTeamObj && (
        <div className="bg-white rounded-lg border border-[var(--color-primary)] p-3 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wide text-[var(--color-primary)] font-semibold">
                My Team
              </span>
              <p className="font-medium text-sm">{myTeamObj.displayName}</p>
              <p className="text-xs text-slate-500">
                {myTeamObj.levelId.toUpperCase()} — Pool {myTeamObj.pool}
              </p>
            </div>
            <button
              onClick={() => setMyTeam(null)}
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {friendTeamObjs.map((team) => (
        <div
          key={team.id}
          className="bg-white rounded-lg border border-slate-200 p-3 mb-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wide text-amber-600 font-semibold">
                Friend&apos;s Team
              </span>
              <p className="font-medium text-sm">{team.displayName}</p>
              <p className="text-xs text-slate-500">
                {team.levelId.toUpperCase()} — Pool {team.pool}
              </p>
            </div>
            <button
              onClick={() => removeFriendTeam(team.id)}
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {/* Search */}
      <div className="mt-4 mb-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams (name, number, or level)..."
          className="w-full h-12 px-4 rounded-lg border border-slate-300 bg-white text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          autoComplete="off"
        />
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {results.map(({ item: team }) => {
            const isMyTeam = myTeam === team.id;
            const isFriend = friendTeams.includes(team.id);

            return (
              <div
                key={team.id}
                className="flex items-center justify-between p-3"
              >
                <div>
                  <p className="text-sm font-medium">{team.displayName}</p>
                  <p className="text-xs text-slate-500">
                    {team.levelId.toUpperCase()} — Pool {team.pool} — #{team.number}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!isMyTeam && !isFriend && (
                    <>
                      <button
                        onClick={() => {
                          setMyTeam(team.id);
                          setQuery("");
                        }}
                        className="text-xs bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-md font-medium active:opacity-80"
                      >
                        My Team
                      </button>
                      <button
                        onClick={() => {
                          addFriendTeam(team.id);
                          setQuery("");
                        }}
                        className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-md font-medium active:opacity-80"
                      >
                        Friend
                      </button>
                    </>
                  )}
                  {isMyTeam && (
                    <span className="text-xs text-[var(--color-primary)] font-semibold px-2">
                      My Team
                    </span>
                  )}
                  {isFriend && (
                    <span className="text-xs text-amber-600 font-semibold px-2">
                      Friend
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {query.trim() && results.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">
          No teams found for &ldquo;{query}&rdquo;
        </p>
      )}

      {(myTeam || friendTeams.length > 0) && (
        <Link
          href="/dashboard"
          className="block mt-6 text-center bg-[var(--color-primary)] text-white py-3 rounded-lg font-semibold text-sm active:opacity-80"
        >
          Go to Dashboard
        </Link>
      )}
    </div>
  );
}
