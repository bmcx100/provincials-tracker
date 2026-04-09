"use client";

import { Score } from "./types";

const KEYS = {
  myKidTeams: "prov-my-kid-teams",
  friendTeams: "prov-friend-teams",
  scores: "prov-scores",
} as const;

// Old keys for migration
const OLD_KEYS = {
  myTeam: "wha-my-team",
  friendTeams: "wha-friend-teams",
  otherTeams: "wha-other-teams",
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

// Migrate from old storage keys to new ones (run once on hydrate)
export function migrateStorage(): void {
  if (typeof window === "undefined") return;

  // Already migrated if new keys exist
  if (localStorage.getItem(KEYS.myKidTeams) || localStorage.getItem(KEYS.friendTeams)) return;

  const oldMyTeam = safeGet<string | null>(OLD_KEYS.myTeam, null);
  const oldFriendTeams = safeGet<string[]>(OLD_KEYS.friendTeams, []);
  const oldOtherTeams = safeGet<string[]>(OLD_KEYS.otherTeams, []);
  const oldScores = safeGet<Record<string, Score>>(OLD_KEYS.scores, {});

  // Only migrate if there's old data
  if (!oldMyTeam && oldFriendTeams.length === 0 && oldOtherTeams.length === 0) return;

  // myTeam → myKidTeams (promote the primary team)
  const kidTeams: string[] = [];
  if (oldMyTeam) kidTeams.push(oldMyTeam);

  // friendTeams + otherTeams → friendTeams in new model
  const friends = [...oldFriendTeams, ...oldOtherTeams];

  safeSet(KEYS.myKidTeams, kidTeams);
  safeSet(KEYS.friendTeams, friends);

  if (Object.keys(oldScores).length > 0) {
    safeSet(KEYS.scores, oldScores);
  }

  // Clean up old keys
  localStorage.removeItem(OLD_KEYS.myTeam);
  localStorage.removeItem(OLD_KEYS.friendTeams);
  localStorage.removeItem(OLD_KEYS.otherTeams);
  localStorage.removeItem(OLD_KEYS.scores);
}

// My Kid teams
export function getMyKidTeams(): string[] {
  return safeGet<string[]>(KEYS.myKidTeams, []);
}

export function setMyKidTeams(teams: string[]): void {
  safeSet(KEYS.myKidTeams, teams);
}

export function addMyKidTeam(teamId: string): void {
  const kids = getMyKidTeams();
  if (!kids.includes(teamId)) {
    safeSet(KEYS.myKidTeams, [...kids, teamId]);
  }
}

export function removeMyKidTeam(teamId: string): void {
  const kids = getMyKidTeams();
  safeSet(KEYS.myKidTeams, kids.filter((t) => t !== teamId));
}

// Friend teams
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
  safeSet(KEYS.friendTeams, friends.filter((t) => t !== teamId));
}

// Move team between sections
export function moveToMyKid(teamId: string): void {
  removeFriendTeam(teamId);
  addMyKidTeam(teamId);
}

export function moveToFriends(teamId: string): void {
  removeMyKidTeam(teamId);
  addFriendTeam(teamId);
}

// Scores
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

// Get all tracked team IDs (my kid + friends)
export function getTrackedTeams(): string[] {
  const kids = getMyKidTeams();
  const friends = getFriendTeams();
  return [...new Set([...kids, ...friends])];
}
