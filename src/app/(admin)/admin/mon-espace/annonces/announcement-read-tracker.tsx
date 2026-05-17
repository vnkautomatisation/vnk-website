"use client";
import { useEffect, useRef, useState } from "react";
import { markAnnouncementReadAction } from "@/app/actions/hr-communications";

export function AnnouncementReadTracker({ announcementId, alreadyRead }: { announcementId: number; alreadyRead: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [marked, setMarked] = useState(alreadyRead);

  useEffect(() => {
    if (marked) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMarked(true);
          markAnnouncementReadAction({ id: announcementId }).catch(() => {});
          obs.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [marked, announcementId]);

  return <div ref={ref} aria-hidden className="h-0 w-0" />;
}
