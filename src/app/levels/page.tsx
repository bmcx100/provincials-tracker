import schedule from "@/data/schedule.json";
import { Schedule } from "@/lib/types";
import Link from "next/link";

const data = schedule as Schedule;

export default function LevelsPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">All Levels</h1>
      <div className="grid grid-cols-2 gap-3">
        {data.levels.map((level) => (
          <Link
            key={level.id}
            href={`/level/${level.id}`}
            className="bg-white rounded-lg border border-slate-200 p-4 active:bg-slate-50 transition-colors"
          >
            <h2 className="font-bold text-lg">{level.name}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {level.teams.length} teams · {level.pools.length} pools
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {level.games.length} games
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
