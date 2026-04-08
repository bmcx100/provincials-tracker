"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserPrefs } from "@/context/UserPrefsContext";

export default function Home() {
  const router = useRouter();
  const { myTeam, hydrated } = useUserPrefs();

  useEffect(() => {
    if (!hydrated) return;
    if (myTeam) {
      router.replace("/dashboard");
    } else {
      router.replace("/select");
    }
  }, [hydrated, myTeam, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
    </div>
  );
}
