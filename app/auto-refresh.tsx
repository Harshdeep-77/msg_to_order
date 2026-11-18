"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-fetches the server-rendered orders every few seconds so new orders appear live.
export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
