"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUserPrefs } from "@/context/UserPrefsContext";
import schedule from "@/data/schedule.json";
import type { SyncResponse } from "@/lib/owha";
import type { Level } from "@/lib/types";

const levels = (schedule as { levels: Level[] }).levels;

type AdminConfig = {
  urls: Record<string, string>; // levelId → OWHA URL
  globalUrl: string;
  useGlobalUrl: boolean;
  overrides: { aid: string; sid: string; gtid: string };
};

const CONFIG_KEY = "prov-admin-config";
const SYNC_LOG_KEY = "prov-sync-log";

type SyncLogEntry = {
  timestamp: string;
  levelId: string;
  matched: number;
  completed: number;
  scoresApplied: number;
};

function loadConfig(): AdminConfig {
  if (typeof window === "undefined") return { urls: {}, globalUrl: "", useGlobalUrl: true, overrides: { aid: "", sid: "", gtid: "" } };
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }
  return { urls: {}, globalUrl: "", useGlobalUrl: true, overrides: { aid: "", sid: "", gtid: "" } };
}

function saveConfig(config: AdminConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function loadSyncLog(): SyncLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SYNC_LOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }
  return [];
}

function saveSyncLog(log: SyncLogEntry[]) {
  localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(log.slice(-50)));
}

type SyncStatus = "idle" | "syncing" | "done" | "error";

export default function AdminPage() {
  const { scores, setScore, hydrated } = useUserPrefs();
  const [config, setConfig] = useState<AdminConfig>(loadConfig);
  const [syncStatus, setSyncStatus] = useState<Record<string, SyncStatus>>({});
  const [syncResults, setSyncResults] = useState<Record<string, SyncResponse>>({});
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>(loadSyncLog);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoInterval, setAutoInterval] = useState(60);
  const [activeTab, setActiveTab] = useState<"sync" | "config" | "log">("sync");
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Save config on change
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const getUrl = useCallback(
    (levelId: string) => {
      if (config.useGlobalUrl) return config.globalUrl;
      return config.urls[levelId] || config.globalUrl;
    },
    [config]
  );

  const syncLevel = useCallback(
    async (levelId: string) => {
      const url = getUrl(levelId);
      if (!url) {
        setSyncStatus((s) => ({ ...s, [levelId]: "error" }));
        setSyncResults((r) => ({
          ...r,
          [levelId]: { games: [], summary: { total: 0, completed: 0, matched: 0, unmatched: 0, scores: {} }, error: "No URL configured" },
        }));
        return;
      }

      setSyncStatus((s) => ({ ...s, [levelId]: "syncing" }));

      try {
        const overrides: Record<string, number> = {};
        if (config.overrides.aid) overrides.aid = parseInt(config.overrides.aid);
        if (config.overrides.sid) overrides.sid = parseInt(config.overrides.sid);
        if (config.overrides.gtid) overrides.gtid = parseInt(config.overrides.gtid);

        const res = await fetch("/api/owha-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            levelId,
            mode: "auto",
            overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
          }),
        });

        const data: SyncResponse = await res.json();
        setSyncResults((r) => ({ ...r, [levelId]: data }));
        setSyncStatus((s) => ({ ...s, [levelId]: data.error ? "error" : "done" }));
      } catch (err) {
        setSyncStatus((s) => ({ ...s, [levelId]: "error" }));
        setSyncResults((r) => ({
          ...r,
          [levelId]: { games: [], summary: { total: 0, completed: 0, matched: 0, unmatched: 0, scores: {} }, error: String(err) },
        }));
      }
    },
    [getUrl, config.overrides]
  );

  const syncAll = useCallback(async () => {
    for (const level of levels) {
      if (getUrl(level.id)) {
        await syncLevel(level.id);
      }
    }
  }, [getUrl, syncLevel]);

  // Auto-refresh
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(() => {
        syncAll();
      }, autoInterval * 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, autoInterval, syncAll]);

  const applyScores = (levelId: string) => {
    const result = syncResults[levelId];
    if (!result?.summary?.scores) return;

    let applied = 0;
    for (const [gameId, score] of Object.entries(result.summary.scores)) {
      setScore(parseInt(gameId), score);
      applied++;
    }

    const entry: SyncLogEntry = {
      timestamp: new Date().toISOString(),
      levelId,
      matched: result.summary.matched,
      completed: result.summary.completed,
      scoresApplied: applied,
    };
    const newLog = [entry, ...syncLog];
    setSyncLog(newLog);
    saveSyncLog(newLog);
  };

  const applyAllScores = () => {
    for (const level of levels) {
      if (syncResults[level.id]?.summary?.scores) {
        applyScores(level.id);
      }
    }
  };

  const statusDot = (status: SyncStatus) => {
    switch (status) {
      case "syncing":
        return "bg-yellow-400 animate-pulse";
      case "done":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-slate-300";
    }
  };

  const countExistingScores = (levelId: string): number => {
    const level = levels.find((l) => l.id === levelId);
    if (!level) return 0;
    return level.games.filter((g) => scores[String(g.id)]).length;
  };

  if (!hydrated) {
    return <div className="flex items-center justify-center min-h-screen text-slate-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Header */}
      <div className="bg-[var(--color-primary)] text-white px-4 py-4">
        <h1 className="text-lg font-bold">Admin — OWHA Sync</h1>
        <p className="text-xs text-white/70 mt-0.5">Score sync for Provincials 2026</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white">
        {(["sync", "config", "log"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${
              activeTab === tab
                ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]"
                : "text-slate-500"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="px-4 mt-4 max-w-lg mx-auto">
        {/* ── SYNC TAB ──────────────────────────────────── */}
        {activeTab === "sync" && (
          <div className="space-y-4">
            {/* Global controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={syncAll}
                disabled={!config.globalUrl && Object.keys(config.urls).length === 0}
                className="flex-1 h-12 rounded-lg bg-[var(--color-primary)] text-white font-semibold text-sm disabled:opacity-40 active:opacity-80"
              >
                Sync All Levels
              </button>
              <button
                onClick={applyAllScores}
                disabled={!Object.values(syncResults).some((r) => Object.keys(r?.summary?.scores ?? {}).length > 0)}
                className="flex-1 h-12 rounded-lg bg-green-600 text-white font-semibold text-sm disabled:opacity-40 active:opacity-80"
              >
                Apply All Scores
              </button>
            </div>

            {/* Auto-refresh */}
            <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-slate-200">
              <label className="flex items-center gap-2 flex-1">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">Auto-refresh</span>
              </label>
              <select
                value={autoInterval}
                onChange={(e) => setAutoInterval(parseInt(e.target.value))}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="15">15s</option>
                <option value="30">30s</option>
                <option value="60">60s</option>
                <option value="120">2m</option>
                <option value="300">5m</option>
              </select>
            </div>

            {/* Per-level cards */}
            {levels.map((level) => {
              const status = syncStatus[level.id] || "idle";
              const result = syncResults[level.id];
              const hasUrl = !!getUrl(level.id);
              const existingScores = countExistingScores(level.id);
              const newScores = Object.keys(result?.summary?.scores ?? {}).length;
              const isExpanded = expandedLevel === level.id;

              return (
                <div key={level.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer active:bg-slate-50"
                    onClick={() => setExpandedLevel(isExpanded ? null : level.id)}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot(status)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{level.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {existingScores}/{level.games.length} scored
                        </span>
                      </div>
                      {result && !result.error && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {result.summary.completed} completed, {result.summary.matched} matched
                          {newScores > 0 && (
                            <span className="text-green-600 font-medium"> — {newScores} new</span>
                          )}
                        </p>
                      )}
                      {result?.error && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">{result.error}</p>
                      )}
                      {!hasUrl && (
                        <p className="text-xs text-slate-400 mt-0.5">No URL configured</p>
                      )}
                    </div>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-3 space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => syncLevel(level.id)}
                          disabled={!hasUrl || status === "syncing"}
                          className="flex-1 h-10 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium disabled:opacity-40"
                        >
                          {status === "syncing" ? "Syncing..." : "Sync"}
                        </button>
                        <button
                          onClick={() => applyScores(level.id)}
                          disabled={!newScores}
                          className="flex-1 h-10 rounded-lg bg-green-600 text-white text-xs font-medium disabled:opacity-40"
                        >
                          Apply {newScores || 0} Scores
                        </button>
                      </div>

                      {/* Results detail */}
                      {result && result.games.length > 0 && (
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-slate-400">
                                <th className="pb-1">Home</th>
                                <th className="pb-1">Away</th>
                                <th className="pb-1 text-center">Score</th>
                                <th className="pb-1 text-center">Match</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.games
                                .filter((g) => g.completed)
                                .map((g) => (
                                  <tr key={g.owhaGameId} className="border-t border-slate-50">
                                    <td className="py-1.5 pr-1">
                                      <span className={g.homeTeamMatched ? "" : "text-red-500"}>
                                        {g.homeTeamOwha
                                          .replace(/#\d+/g, "")
                                          .replace(/\([^)]*\)/g, "")
                                          .trim()
                                          .slice(0, 20)}
                                      </span>
                                    </td>
                                    <td className="py-1.5 pr-1">
                                      <span className={g.awayTeamMatched ? "" : "text-red-500"}>
                                        {g.awayTeamOwha
                                          .replace(/#\d+/g, "")
                                          .replace(/\([^)]*\)/g, "")
                                          .trim()
                                          .slice(0, 20)}
                                      </span>
                                    </td>
                                    <td className="py-1.5 text-center font-mono">
                                      {g.homeScore ?? "-"} - {g.awayScore ?? "-"}
                                    </td>
                                    <td className="py-1.5 text-center">
                                      {g.matchedGameId ? (
                                        <span className="text-green-600">#{g.matchedGameId}</span>
                                      ) : (
                                        <span className="text-red-400">--</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Debug info */}
                      {result?.debug && (
                        <details className="text-[10px] text-slate-400">
                          <summary className="cursor-pointer">Debug</summary>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all">
                            {JSON.stringify(result.debug, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── CONFIG TAB ────────────────────────────────── */}
        {activeTab === "config" && (
          <div className="space-y-4">
            {/* Global URL */}
            <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.useGlobalUrl}
                    onChange={(e) => setConfig({ ...config, useGlobalUrl: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium">Use one URL for all levels</span>
                </label>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  {config.useGlobalUrl ? "Global OWHA URL" : "Default OWHA URL (fallback)"}
                </label>
                <input
                  type="url"
                  value={config.globalUrl}
                  onChange={(e) => setConfig({ ...config, globalUrl: e.target.value })}
                  placeholder="https://www.owha.on.ca/division/0/XXXXX/games"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <p className="text-[10px] text-slate-400 leading-snug">
                Paste the OWHA division page URL. Open the provincials page on owha.on.ca, copy the URL.
                For province-wide events, it&apos;s typically /division/0/XXXXX/games.
              </p>
            </div>

            {/* Per-level URLs */}
            {!config.useGlobalUrl && (
              <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                <h3 className="text-sm font-medium">Per-Level URLs</h3>
                {levels.map((level) => (
                  <div key={level.id}>
                    <label className="text-xs text-slate-500">{level.name}</label>
                    <input
                      type="url"
                      value={config.urls[level.id] || ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          urls: { ...config.urls, [level.id]: e.target.value },
                        })
                      }
                      placeholder="https://www.owha.on.ca/division/..."
                      className="w-full border rounded px-2 py-1.5 text-xs mt-0.5"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* API Overrides */}
            <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
              <h3 className="text-sm font-medium">API Overrides (Advanced)</h3>
              <p className="text-[10px] text-slate-400 leading-snug">
                Override OWHA API constants if the defaults don&apos;t work. Find these via DevTools → Network → XHR on the OWHA page.
                Leave blank to use defaults (Playdowns: AID=3617, SID=13359 | Regular: AID=2788, SID=12488).
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">AID</label>
                  <input
                    type="text"
                    value={config.overrides.aid}
                    onChange={(e) =>
                      setConfig({ ...config, overrides: { ...config.overrides, aid: e.target.value } })
                    }
                    placeholder="auto"
                    className="w-full border rounded px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">SID</label>
                  <input
                    type="text"
                    value={config.overrides.sid}
                    onChange={(e) =>
                      setConfig({ ...config, overrides: { ...config.overrides, sid: e.target.value } })
                    }
                    placeholder="auto"
                    className="w-full border rounded px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">GTID</label>
                  <input
                    type="text"
                    value={config.overrides.gtid}
                    onChange={(e) =>
                      setConfig({ ...config, overrides: { ...config.overrides, gtid: e.target.value } })
                    }
                    placeholder="auto"
                    className="w-full border rounded px-2 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Discovery Help */}
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
              <h3 className="text-sm font-medium text-amber-800">How to find the OWHA URL</h3>
              <ol className="text-xs text-amber-700 mt-1 space-y-1 list-decimal list-inside">
                <li>Go to the OWHA provincials page on owha.on.ca</li>
                <li>Find the division/schedule page for the tournament</li>
                <li>Copy the URL — it should look like /division/N/NNNNN/games</li>
                <li>Paste it above</li>
              </ol>
              <p className="text-[10px] text-amber-600 mt-2">
                If the JSON API doesn&apos;t work, open DevTools → Network → XHR, reload the page,
                and check the API calls for AID/SID/GTID values. Enter them in the overrides above.
              </p>
            </div>
          </div>
        )}

        {/* ── LOG TAB ───────────────────────────────────── */}
        {activeTab === "log" && (
          <div className="space-y-2">
            {syncLog.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No sync history yet</p>
            ) : (
              <>
                <button
                  onClick={() => {
                    setSyncLog([]);
                    saveSyncLog([]);
                  }}
                  className="text-xs text-red-500 underline"
                >
                  Clear log
                </button>
                {syncLog.map((entry, i) => (
                  <div key={i} className="bg-white rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {levels.find((l) => l.id === entry.levelId)?.name ?? entry.levelId}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {entry.completed} completed, {entry.matched} matched, {entry.scoresApplied} applied
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
