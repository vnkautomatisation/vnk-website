"use client";
import { Users, Briefcase } from "lucide-react";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon apres-midi";
  return "Bonsoir";
}

export function WelcomeBanner({
  adminName,
  date,
  clientCount,
  mandateCount,
}: {
  adminName: string;
  date: string;
  clientCount: number;
  mandateCount: number;
}) {
  return (
    <div className="relative rounded-2xl vnk-gradient text-white overflow-hidden">
      {/* Cercles decoratifs */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5 hidden sm:block" />
      <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-white/5 hidden sm:block" />
      <div className="absolute top-1/2 right-1/4 w-16 h-16 rounded-full bg-white/5 hidden lg:block" />

      <div className="relative p-5 sm:p-7 lg:p-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
          {getGreeting()}, {adminName.split(" ")[0]}
        </h1>
        <p className="text-white/70 text-sm mt-1">{date}</p>

        <div className="flex flex-wrap gap-2 mt-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-white/10 rounded-full px-3 py-1.5">
            <Users className="h-3.5 w-3.5" />
            {clientCount} clients actifs
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-white/10 rounded-full px-3 py-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            {mandateCount} mandats en cours
          </span>
        </div>
      </div>
    </div>
  );
}
