"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Fuse from "fuse.js";
import schedule from "@/data/schedule.json";
import { useUserPrefs } from "@/context/UserPrefsContext";
import { Team, Schedule } from "@/lib/types";
import { getAssociations, splitAssociation, Association } from "@/lib/associations";
import { getLogoUrl } from "@/data/logos";
import { getRanking } from "@/data/rankings";

const data = schedule as Schedule;
const allTeams: Team[] = data.levels.flatMap((level) => level.teams as Team[]);
const associations = getAssociations();

const fuse = new Fuse(allTeams, {
  keys: ["name", "displayName", "number", "levelId"],
  threshold: 0.35,
  includeScore: true,
});

const AGE_GROUPS = ["U11", "U13", "U15", "U18"] as const;
const LEVEL_LETTERS = ["AA", "A", "BB", "B", "C"] as const;

type AgeGroup = (typeof AGE_GROUPS)[number];
type LevelLetter = (typeof LEVEL_LETTERS)[number];

function parseLevelId(id: string): { age: AgeGroup; letter: LevelLetter } | null {
  const upper = id.toUpperCase();
  for (const age of AGE_GROUPS) {
    if (upper.startsWith(age)) {
      const letter = upper.slice(age.length) as LevelLetter;
      if ((LEVEL_LETTERS as readonly string[]).includes(letter)) {
        return { age, letter };
      }
    }
  }
  return null;
}

const AGE_RANK: Record<string, number> = { U11: 0, U13: 1, U15: 2, U18: 3 };
const LETTER_RANK: Record<string, number> = { AA: 0, A: 1, BB: 2, B: 3, C: 4 };

function sortByLevel(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    const pa = parseLevelId(a.levelId);
    const pb = parseLevelId(b.levelId);
    if (pa && pb) {
      const ageD = (AGE_RANK[pa.age] ?? 99) - (AGE_RANK[pb.age] ?? 99);
      if (ageD !== 0) return ageD;
      return (LETTER_RANK[pa.letter] ?? 99) - (LETTER_RANK[pb.letter] ?? 99);
    }
    return a.levelId.localeCompare(b.levelId);
  });
}

const VALID_LEVELS = new Set(data.levels.map((l) => l.id.toUpperCase()));

function hasLevel(age: AgeGroup, letter: LevelLetter): boolean {
  return VALID_LEVELS.has(`${age}${letter}`);
}

// Logo component with fallback initials
function AssocLogo({ name, size = 40 }: { name: string; size?: number }) {
  const url = getLogoUrl(name);
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover bg-slate-100"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  const initials = name
    .split(" ")
    .filter((w) => w[0] && w[0] === w[0].toUpperCase())
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundColor: `hsl(${hue}, 50%, 45%)`,
      }}
    >
      {initials}
    </div>
  );
}

// Banner map: association name → banner image path
const BANNER_MAP: Record<string, string> = {
  "Nepean Wildcats": "/images/wildcats_short_banner.png",
  "Ottawa Ice": "/images/ice_short_banner.png",
};

function getBanner(assocName: string): string | undefined {
  return BANNER_MAP[assocName];
}

// Fallback banner color from team name
function getBannerColor(name: string): string {
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 35%, 30%)`;
}

// Heart SVG paths
const HEART_FILLED = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
const HEART_OUTLINE = "M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5 18.5 5 20 6.5 20 8.5c0 2.89-3.14 5.74-7.9 10.05z";

// Banner-style team card with move action
function TeamCard({
  team,
  isFavorited,
  onToggle,
  moveLabel,
  onMove,
}: {
  team: Team;
  isFavorited: boolean;
  onToggle: () => void;
  moveLabel?: string;
  onMove?: () => void;
}) {
  const banner = getBanner(team.name);
  const logoUrl = getLogoUrl(team.name);
  const ranking = getRanking(team.levelId, team.name);

  return (
    <div className="rounded-xl overflow-hidden">
      <div
        className="relative flex items-center min-h-[4rem] py-3 px-4"
        style={
          banner
            ? {
                backgroundImage: `url(${banner})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background: `linear-gradient(135deg, ${getBannerColor(team.name)} 0%, ${getBannerColor(team.name + "x")} 100%)`,
              }
        }
      >
        {/* Fallback: show CDN logo as watermark in center when no banner */}
        {!banner && logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full opacity-40 object-cover"
          />
        )}

        {/* Level ID + rank */}
        <div className="relative z-10 flex items-center gap-2">
          <span
            className="text-xl font-semibold text-white"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
          >
            {team.levelId.toUpperCase()}
          </span>
          {ranking && (
            <span
              className="text-sm font-bold text-white/70"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
            >
              #{ranking.rank}
            </span>
          )}
        </div>

        {/* Move button + Heart toggle */}
        <div className="ml-auto relative z-10 flex items-center gap-2">
          {moveLabel && onMove && (
            <button
              onClick={onMove}
              className="text-[10px] font-bold text-white/70 bg-white/20 rounded-full px-2.5 py-1 active:bg-white/30"
            >
              {moveLabel}
            </button>
          )}
          <button onClick={onToggle} className="shrink-0 p-1">
            <svg
              className={`w-6 h-6 transition-colors ${
                isFavorited ? "text-white/80" : "text-white/40"
              }`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d={isFavorited ? HEART_FILLED : HEART_OUTLINE} />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Association tile used in both favorites row and full scroller
function AssocTile({
  assoc,
  selected,
  isFavorited,
  onSelect,
  buttonRef,
  dark,
}: {
  assoc: Association;
  selected: boolean;
  isFavorited?: boolean;
  onSelect: () => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
  dark?: boolean;
}) {
  const { location, teamName } = splitAssociation(assoc.name);
  return (
    <button
      ref={buttonRef}
      onClick={onSelect}
      className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl transition-all shrink-0 min-w-[96px] ${
        selected
          ? dark
            ? "bg-white/20 ring-2 ring-white"
            : "bg-blue-50 ring-2 ring-[var(--color-primary)]"
          : isFavorited
          ? dark
            ? "ring-2 ring-amber-400/70 bg-white/10"
            : "ring-2 ring-amber-400 bg-amber-50/50"
          : dark
          ? "active:bg-white/10"
          : "active:bg-slate-50"
      }`}
    >
      <AssocLogo name={assoc.name} size={60} />
      <div className="text-center leading-tight">
        <div
          className={`text-sm font-bold ${
            selected
              ? dark ? "text-white" : "text-[var(--color-primary)]"
              : dark ? "text-white" : "text-slate-800"
          }`}
        >
          {location}
        </div>
        {teamName && (
          <div
            className={`text-xs ${
              selected
                ? dark ? "text-white/80" : "text-[var(--color-primary)]"
                : dark ? "text-white/60" : "text-slate-500"
            }`}
          >
            {teamName}
          </div>
        )}
      </div>
    </button>
  );
}

// Association horizontal scroller with logos
function AssocScroller({
  associations: assocs,
  selected,
  onSelect,
  animateIn,
  favoritedNames,
  dark,
}: {
  associations: Association[];
  selected: string | null;
  onSelect: (name: string) => void;
  animateIn?: boolean;
  favoritedNames?: Set<string>;
  dark?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!animateIn || !scrollRef.current) return;
    const container = scrollRef.current;
    container.scrollLeft = 0;
    const timer = setTimeout(() => {
      const midIndex = Math.floor(assocs.length / 2);
      const midAssoc = assocs[midIndex];
      if (midAssoc) {
        const el = itemRefs.current.get(midAssoc.name);
        if (el) {
          const scrollLeft = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
          container.scrollTo({ left: scrollLeft, behavior: "smooth" });
        }
      }
    }, 80);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (assocs.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex gap-3 overflow-x-auto scrollbar-hide py-2 px-1"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {assocs.map((assoc) => (
        <AssocTile
          key={assoc.name}
          assoc={assoc}
          selected={selected === assoc.name}
          isFavorited={favoritedNames?.has(assoc.name)}
          onSelect={() => onSelect(assoc.name)}
          dark={dark}
          buttonRef={(el) => {
            if (el) itemRefs.current.set(assoc.name, el);
          }}
        />
      ))}
    </div>
  );
}

// Default associations that always appear in favorites
const DEFAULT_FAVORITE_ASSOCS = ["Nepean Wildcats", "Ottawa Ice"];

// Inline Add Team section
function AddTeamSection({ onDone }: { onDone: () => void }) {
  const { myKidTeams, friendTeams, addFriendTeam, removeFriendTeam, removeMyKidTeam } = useUserPrefs();
  const [query, setQuery] = useState("");
  const [selectedAge, setSelectedAge] = useState<AgeGroup | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<LevelLetter | null>(null);
  const [selectedAssoc, setSelectedAssoc] = useState<string | null>("Nepean Wildcats");
  const [showAllAssocs, setShowAllAssocs] = useState(false);

  // Set of all tracked team IDs for quick lookup
  const trackedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of myKidTeams) ids.add(id);
    for (const id of friendTeams) ids.add(id);
    return ids;
  }, [myKidTeams, friendTeams]);

  // Derive favorite associations from tracked teams + defaults
  const favoriteAssocs = useMemo(() => {
    const assocNames = new Set<string>(DEFAULT_FAVORITE_ASSOCS);
    for (const id of [...myKidTeams, ...friendTeams]) {
      const team = allTeams.find((t) => t.id === id);
      if (team) assocNames.add(team.name);
    }
    return associations.filter((a) => assocNames.has(a.name));
  }, [myKidTeams, friendTeams]);

  const favoritedAssocNames = useMemo(
    () => new Set(favoriteAssocs.map((a) => a.name)),
    [favoriteAssocs]
  );

  // Filter associations based on whatever age/level is selected
  const filteredAssocs = useMemo(() => {
    if (!selectedAge && !selectedLetter) return associations;
    return associations.filter((a) =>
      a.teams.some((t) => {
        const p = parseLevelId(t.levelId);
        if (!p) return false;
        if (selectedAge && p.age !== selectedAge) return false;
        if (selectedLetter && p.letter !== selectedLetter) return false;
        return true;
      })
    );
  }, [selectedAge, selectedLetter]);

  // Filtered favorites (respect partial level filter)
  const filteredFavorites = useMemo(() => {
    if (!selectedAge && !selectedLetter) return favoriteAssocs;
    return favoriteAssocs.filter((a) =>
      a.teams.some((t) => {
        const p = parseLevelId(t.levelId);
        if (!p) return false;
        if (selectedAge && p.age !== selectedAge) return false;
        if (selectedLetter && p.letter !== selectedLetter) return false;
        return true;
      })
    );
  }, [favoriteAssocs, selectedAge, selectedLetter]);

  // Matching teams based on whatever combination of filters is active
  const matchingTeams = useMemo(() => {
    if (!selectedAssoc && !selectedAge && !selectedLetter) return [];

    const filtered = allTeams.filter((t) => {
      if (selectedAssoc && t.name !== selectedAssoc) return false;
      const p = parseLevelId(t.levelId);
      if (!p) return false;
      if (selectedAge && p.age !== selectedAge) return false;
      if (selectedLetter && p.letter !== selectedLetter) return false;
      return true;
    });
    return sortByLevel(filtered);
  }, [selectedAssoc, selectedAge, selectedLetter]);

  // Toggle a team in/out of favorites (adds to Friends by default)
  const toggleTeam = useCallback(
    (teamId: string) => {
      if (myKidTeams.includes(teamId)) {
        removeMyKidTeam(teamId);
      } else if (friendTeams.includes(teamId)) {
        removeFriendTeam(teamId);
      } else {
        addFriendTeam(teamId);
      }
    },
    [myKidTeams, friendTeams, removeMyKidTeam, removeFriendTeam, addFriendTeam]
  );

  // Search: populate filters from result
  const handleSearchSelect = useCallback((team: Team) => {
    const parsed = parseLevelId(team.levelId);
    if (parsed) {
      setSelectedAge(parsed.age);
      setSelectedLetter(parsed.letter);
    }
    setSelectedAssoc(team.name);
    setQuery("");
  }, []);

  return (
    <div className="mt-6 bg-[var(--color-primary)] rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="relative flex items-center justify-center">
        <h2 className="text-base font-bold text-white text-center">Add Team</h2>
        <button
          onClick={onDone}
          className="absolute right-0 text-xs text-white/60 hover:text-white px-2 py-1"
        >
          Close
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams..."
          className="w-full h-12 pl-4 pr-11 rounded-lg border border-white/20 bg-white/15 text-white text-sm placeholder:text-white/50 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
          autoComplete="off"
        />
        <div className="absolute right-0 top-0 h-12 w-11 flex items-center justify-center">
          <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Search results */}
      {query.trim() && (() => {
        const results = fuse.search(query).slice(0, 15);
        if (results.length === 0) {
          return (
            <p className="text-sm text-white/50 text-center py-4">
              No teams found for &ldquo;{query}&rdquo;
            </p>
          );
        }
        return (
          <div className="bg-white/10 rounded-lg divide-y divide-white/10 overflow-hidden">
            {results.map(({ item: team }) => (
              <button
                key={team.id}
                onClick={() => handleSearchSelect(team)}
                className="w-full flex items-center gap-3 p-3.5 active:bg-white/10 text-left"
              >
                <AssocLogo name={team.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-white truncate">{team.displayName}</p>
                  <p className="text-sm text-white/60">
                    {team.levelId.toUpperCase()} — Pool {team.pool}
                  </p>
                </div>
              </button>
            ))}
          </div>
        );
      })()}

      {/* Level + Association pickers */}
      {!query.trim() && (
        <>
          {/* Age group row */}
          <div className="flex gap-2 justify-center">
            {AGE_GROUPS.map((age) => (
              <button
                key={age}
                onClick={() => setSelectedAge((v) => (v === age ? null : age))}
                className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
                  selectedAge === age
                    ? "bg-white text-[var(--color-primary)] shadow-sm"
                    : "bg-white/15 border border-white/20 text-white active:bg-white/25"
                }`}
              >
                {age}
              </button>
            ))}
          </div>

          {/* Level letter row */}
          <div className="flex gap-2 justify-center">
            {LEVEL_LETTERS.map((letter) => {
              const enabled = selectedAge ? hasLevel(selectedAge, letter) : true;
              return (
                <button
                  key={letter}
                  onClick={() => enabled && setSelectedLetter((v) => (v === letter ? null : letter))}
                  disabled={!enabled}
                  className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
                    selectedLetter === letter
                      ? "bg-white text-[var(--color-primary)] shadow-sm"
                      : enabled
                      ? "bg-white/15 border border-white/20 text-white active:bg-white/25"
                      : "bg-white/5 border border-white/10 text-white/25"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          {/* Favorites row with + More button */}
          <div
            className="flex gap-3 overflow-x-auto scrollbar-hide py-2 px-1"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {filteredFavorites.map((assoc) => (
              <AssocTile
                key={assoc.name}
                assoc={assoc}
                selected={selectedAssoc === assoc.name}
                onSelect={() => setSelectedAssoc((v) => (v === assoc.name ? null : assoc.name))}
                dark
              />
            ))}

            {/* + More button */}
            <button
              onClick={() => setShowAllAssocs((v) => !v)}
              className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl transition-all shrink-0 min-w-[96px] ${
                showAllAssocs ? "bg-white/15" : "active:bg-white/10"
              }`}
            >
              <div
                className={`w-[60px] h-[60px] rounded-full flex items-center justify-center transition-colors ${
                  showAllAssocs ? "bg-white" : "bg-white/25"
                }`}
              >
                <svg
                  className={`w-7 h-7 ${showAllAssocs ? "text-[var(--color-primary)]" : "text-white"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  {showAllAssocs ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  )}
                </svg>
              </div>
              <div className={`text-sm font-bold ${showAllAssocs ? "text-white" : "text-white/60"}`}>
                {showAllAssocs ? "Less" : "More"}
              </div>
            </button>
          </div>

          {/* All associations */}
          {showAllAssocs && (
            <AssocScroller
              associations={filteredAssocs}
              selected={selectedAssoc}
              onSelect={(name) => setSelectedAssoc((v) => (v === name ? null : name))}
              animateIn
              favoritedNames={favoritedAssocNames}
              dark
            />
          )}

          {/* Matching teams — banner cards with heart toggle */}
          {matchingTeams.length > 0 && (
            <div className="max-h-[20rem] overflow-y-auto rounded-xl space-y-2">
              {matchingTeams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  isFavorited={trackedIds.has(team.id)}
                  onToggle={() => toggleTeam(team.id)}
                />
              ))}
            </div>
          )}

          {/* Hint */}
          {matchingTeams.length === 0 && !selectedAssoc && !selectedAge && !selectedLetter && (
            <div className="text-center py-4 text-sm text-white/50">
              Pick an age, level, or association to see teams
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MyTeamsPage() {
  const {
    myKidTeams,
    friendTeams,
    hydrated,
    removeMyKidTeam,
    removeFriendTeam,
    moveToMyKid,
    moveToFriends,
  } = useUserPrefs();
  const [showAdd, setShowAdd] = useState(false);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  const kidTeamObjs = sortByLevel(
    myKidTeams.map((id) => allTeams.find((t) => t.id === id)).filter(Boolean) as Team[]
  );
  const friendTeamObjs = sortByLevel(
    friendTeams.map((id) => allTeams.find((t) => t.id === id)).filter(Boolean) as Team[]
  );

  const hasAnyTeams = kidTeamObjs.length > 0 || friendTeamObjs.length > 0;

  if (!hasAnyTeams && !showAdd) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold mb-2">My Teams</h1>
        <p className="text-sm text-slate-500 mb-6">
          Add your kid&apos;s team and track friends&apos; teams throughout the tournament.
        </p>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-block bg-[var(--color-primary)] text-white py-3 px-6 rounded-lg font-semibold text-sm active:opacity-80"
        >
          Add Your First Team
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">My Teams</h1>

      {/* My Kid section */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
          My Kid
        </h2>
        {kidTeamObjs.length > 0 ? (
          <div className="flex flex-col gap-2">
            {kidTeamObjs.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                isFavorited={true}
                onToggle={() => removeMyKidTeam(team.id)}
                moveLabel="→ Friends"
                onMove={() => moveToFriends(team.id)}
              />
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-200 rounded-xl py-6 text-center text-sm text-slate-400">
            Add a team below then move it here
          </div>
        )}
      </div>

      {/* My Friends section */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          My Friends
        </h2>
        {friendTeamObjs.length > 0 ? (
          <div className="flex flex-col gap-2">
            {friendTeamObjs.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                isFavorited={true}
                onToggle={() => removeFriendTeam(team.id)}
                moveLabel="→ My Kid"
                onMove={() => moveToMyKid(team.id)}
              />
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-200 rounded-xl py-4 text-center text-sm text-slate-400">
            No friends&apos; teams yet
          </div>
        )}
      </div>

      {/* Add Team inline section or button */}
      {showAdd ? (
        <AddTeamSection onDone={() => setShowAdd(false)} />
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="block w-full text-center bg-[var(--color-primary)] text-white py-3.5 rounded-lg font-semibold text-sm active:opacity-80"
        >
          + Add Team
        </button>
      )}
    </div>
  );
}
