export interface Team {
  id: string; // e.g. "120-u11aa"
  number: number;
  name: string;
  displayName: string;
  pool: string;
  levelId: string;
}

export interface PoolRef {
  type: "pool-rank";
  pool?: string; // for 8-pool QF format, pool letter
  rank: number; // for ranked formats (5pool, 6pool), overall rank among pool winners
}

export interface GameWinnerRef {
  type: "game-winner";
  gameId: number;
}

export interface GameLoserRef {
  type: "game-loser";
  gameId: number;
}

export type TeamRef = PoolRef | GameWinnerRef | GameLoserRef;

export interface Game {
  id: number;
  levelId: string;
  day: string;
  date: string;
  time: string;
  rink: string;
  phase: "round-robin" | "quarter-final" | "semi-final" | "gold-medal" | "bronze-medal";
  pool?: string;
  homeTeamId?: string; // for round-robin games
  awayTeamId?: string;
  homeRef?: TeamRef; // for playoff games
  awayRef?: TeamRef;
}

export interface Pool {
  id: string;
  teams: string[]; // team IDs
}

export type PlayoffFormat = "8pool-qf" | "4pool-no-qf" | "5pool-ranked" | "6pool-ranked";

export interface Level {
  id: string; // e.g. "u11aa"
  name: string; // e.g. "U11AA"
  pools: Pool[];
  teams: Team[];
  games: Game[];
  playoffFormat: PlayoffFormat;
}

export interface Schedule {
  levels: Level[];
}

export interface Score {
  home: number;
  away: number;
}

export interface Standing {
  teamId: string;
  teamName: string;
  gp: number;
  w: number;
  l: number;
  t: number;
  pts: number;
  gf: number;
  ga: number;
  gd: number;
}
