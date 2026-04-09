"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Score } from "@/lib/types";
import * as storage from "@/lib/storage";

interface UserPrefs {
  myKidTeams: string[];
  friendTeams: string[];
  scores: Record<string, Score>;
  hydrated: boolean;
  addMyKidTeam: (teamId: string) => void;
  removeMyKidTeam: (teamId: string) => void;
  addFriendTeam: (teamId: string) => void;
  removeFriendTeam: (teamId: string) => void;
  moveToMyKid: (teamId: string) => void;
  moveToFriends: (teamId: string) => void;
  setScore: (gameId: number, score: Score) => void;
  clearScore: (gameId: number) => void;
  trackedTeams: string[];
}

const UserPrefsContext = createContext<UserPrefs>({
  myKidTeams: [],
  friendTeams: [],
  scores: {},
  hydrated: false,
  addMyKidTeam: () => {},
  removeMyKidTeam: () => {},
  addFriendTeam: () => {},
  removeFriendTeam: () => {},
  moveToMyKid: () => {},
  moveToFriends: () => {},
  setScore: () => {},
  clearScore: () => {},
  trackedTeams: [],
});

export function UserPrefsProvider({ children }: { children: React.ReactNode }) {
  const [myKidTeams, setMyKidTeamsState] = useState<string[]>([]);
  const [friendTeams, setFriendTeamsState] = useState<string[]>([]);
  const [scores, setScoresState] = useState<Record<string, Score>>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount (with migration)
  useEffect(() => {
    storage.migrateStorage();
    setMyKidTeamsState(storage.getMyKidTeams());
    setFriendTeamsState(storage.getFriendTeams());
    setScoresState(storage.getScores());
    setHydrated(true);
  }, []);

  const addMyKidTeam = useCallback((teamId: string) => {
    storage.addMyKidTeam(teamId);
    setMyKidTeamsState(storage.getMyKidTeams());
  }, []);

  const removeMyKidTeam = useCallback((teamId: string) => {
    storage.removeMyKidTeam(teamId);
    setMyKidTeamsState(storage.getMyKidTeams());
  }, []);

  const addFriendTeam = useCallback((teamId: string) => {
    storage.addFriendTeam(teamId);
    setFriendTeamsState(storage.getFriendTeams());
  }, []);

  const removeFriendTeam = useCallback((teamId: string) => {
    storage.removeFriendTeam(teamId);
    setFriendTeamsState(storage.getFriendTeams());
  }, []);

  const moveToMyKid = useCallback((teamId: string) => {
    storage.moveToMyKid(teamId);
    setMyKidTeamsState(storage.getMyKidTeams());
    setFriendTeamsState(storage.getFriendTeams());
  }, []);

  const moveToFriends = useCallback((teamId: string) => {
    storage.moveToFriends(teamId);
    setMyKidTeamsState(storage.getMyKidTeams());
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

  const trackedTeams = [...new Set([...myKidTeams, ...friendTeams])];

  return (
    <UserPrefsContext.Provider
      value={{
        myKidTeams,
        friendTeams,
        scores,
        hydrated,
        addMyKidTeam,
        removeMyKidTeam,
        addFriendTeam,
        removeFriendTeam,
        moveToMyKid,
        moveToFriends,
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
