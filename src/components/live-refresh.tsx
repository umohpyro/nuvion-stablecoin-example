"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Pulse } from "@/lib/pulse";

const INTERVAL_MS = 5000;

/**
 * Keeps the dashboard current. Every few seconds, while this tab is visible, it asks /api/pulse for a stamp and
 * refreshes the page's server data when the stamp changes. Pauses in a background tab and stops for good if the
 * visitor isn't connected.
 */
export function LiveRefresh() {
  const router = useRouter();
  const pathname = usePathname(); // a new page load (for example right after connecting) starts the watch again
  const last = useRef<Pulse | null>(null);

  useEffect(() => {
    let stopped = false;
    last.current = null;
    const tick = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/pulse", { cache: "no-store" });
        if (res.status === 401) {
          stopped = true; // not connected: nothing to watch until the next page load
          return;
        }
        if (!res.ok) return;
        const pulse = (await res.json()) as Pulse;
        // A mode change (a webhook was just registered or removed) only resets the baseline: it isn't an event.
        if (last.current && last.current.mode === pulse.mode && last.current.stamp !== pulse.stamp) {
          router.refresh();
          toast.message(pulse.mode === "webhook" ? "Nuvion sent an event. Balances refreshed." : "Balances changed. Refreshed.");
        }
        last.current = pulse;
      } catch {
        // A failed poll is just a missed beat; the next one tries again.
      }
    };
    void tick();
    const timer = setInterval(tick, INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [router, pathname]);

  return null;
}
