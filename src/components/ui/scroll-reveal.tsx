"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ScrollReveal({
  children,
  className,
  animation = "animate-reveal-up",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  animation?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const el = ref.current;
    if (!el) return;

    // If element is already in viewport on mount, show immediately
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.85) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Before hydration: show content normally (no animation)
  // After hydration: hidden until scrolled into view, then animate
  const isHidden = mounted && !visible;

  return (
    <div
      ref={ref}
      className={cn(
        isHidden ? "opacity-0" : visible ? animation : "",
        className
      )}
      style={visible && delay ? { animationDelay: `${delay}ms`, animationFillMode: "both" } : undefined}
    >
      {children}
    </div>
  );
}
