"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AddTeamRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/my-teams");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
    </div>
  );
}
