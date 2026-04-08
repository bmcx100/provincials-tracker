"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Score } from "@/lib/types";
import * as storage from "@/lib/storage";

interface UserPrefs {
  myTeam: string | null;
  friendTeams: string[];
  scores: Record<string, Score>;
  hydrated: boolean;
  setMyTeam: (teamId: string | null) => void;
  addFriendTeam: (teamId: string) => void;
  removeFriendTeam: (teamId: string) => void;
  setScore: (gameId: number, score: Score) => void;
  clearScore: (gameId: number) => void;
  trackedTeams: string[];
}

const UserPrefsContext = createContext<UserPrefs>({
  myTeam: null,
  friendTeams: [],
  scores: {},
  hydrated: false,
  setMyTeam: () => {},
  addFriendTeam: () => {},
  removeFriendTeam: () => {},
  setScore: () => {},
  clearScore: () => {},
  trackedTeams: [],
});

export function UserPrefsProvider({ children }: { children: React.ReactNode }) {
  const [myTeam, setMyTeamState] = useState<string | null>(null);
  const [friendTeams, setFriendTeamsState] = useState<string[]>([]);
  const [scores, setScoresState] = useState<Record<string, Score>>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setMyTeamState(storage.getMyTeam());
    setFriendTeamsState(storage.getFriendTeams());
    setScoresState(storage.getScores());
    setHydrated(true);
  }, []);

  const setMyTeam = useCallback((teamId: string | null) => {
    storage.setMyTeam(teamId);
    setMyTeamState(teamId);
  }, []);

  const addFriendTeam = useCallback((teamId: string) => {
    storage.addFriendTeam(teamId);
    setFriendTeamsState(storage.getFriendTeams());
  }, []);

  const removeFriendTeam = useCallback((teamId: string) => {
    storage.removeFriendTeam(teamId);
    setFriendTeamsState(storage.getFriendTeams());
  }, []);

  const setScore = useCallback((gameId: number, score: Score) => {
    storage.setScore(gameId, score);
    setScoresState(storage.getScores());
  }, []);

  const clearScore = useCallback((gameId: number) => {
    storage.clearScore(gameId);
    setScoresState(storage.getScores());
  }, []);

  const trackedTeams = myTeam
    ? [myTeam, ...friendTeams.filter((f) => f !== myTeam)]
    : friendTeams;

  return (
    <UserPrefsContext.Provider
      value={{
        myTeam,
        friendTeams,
        scores,
        hydrated,
        setMyTeam,
        addFriendTeam,
        removeFriendTeam,
        setScore,
        clearScore,
        trackedTeams,
      }}
    >
      {children}
    </UserPrefsContext.Provider>
  );
}

export function useUserPrefs() {
  return useContext(UserPrefsContext);
}
