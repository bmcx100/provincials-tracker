"use client";

import { Score } from "./types";

const KEYS = {
  myTeam: "wha-my-team",
  friendTeams: "wha-friend-teams",
  scores: "wha-scores",
} as const;

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable
  }
}

// My team: "teamId" (e.g. "120-u11aa")
export function getMyTeam(): string | null {
  return safeGet<string | null>(KEYS.myTeam, null);
}

export function setMyTeam(teamId: string | null): void {
  if (teamId) {
    safeSet(KEYS.myTeam, teamId);
  } else {
    localStorage.removeItem(KEYS.myTeam);
  }
}

// Friend teams: array of teamIds
export function getFriendTeams(): string[] {
  return safeGet<string[]>(KEYS.friendTeams, []);
}

export function setFriendTeams(teams: string[]): void {
  safeSet(KEYS.friendTeams, teams);
}

export function addFriendTeam(teamId: string): void {
  const friends = getFriendTeams();
  if (!friends.includes(teamId)) {
    safeSet(KEYS.friendTeams, [...friends, teamId]);
  }
}

export function removeFriendTeam(teamId: string): void {
  const friends = getFriendTeams();
  safeSet(
    KEYS.friendTeams,
    friends.filter((t) => t !== teamId)
  );
}

// Scores: { [gameId]: { home, away } }
export function getScores(): Record<string, Score> {
  return safeGet<Record<string, Score>>(KEYS.scores, {});
}

export function setScore(gameId: number, score: Score): void {
  const scores = getScores();
  scores[String(gameId)] = score;
  safeSet(KEYS.scores, scores);
}

export function clearScore(gameId: number): void {
  const scores = getScores();
  delete scores[String(gameId)];
  safeSet(KEYS.scores, scores);
}

// Get all tracked team IDs (my team + friends)
export function getTrackedTeams(): string[] {
  const myTeam = getMyTeam();
  const friends = getFriendTeams();
  const all = myTeam ? [myTeam, ...friends] : friends;
  return [...new Set(all)];
}
