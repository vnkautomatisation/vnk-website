"use client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import { Shield, Clock } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
};

export function ProfileBanner({
  fullName,
  email,
  role,
  lastLogin,
  createdAt,
}: {
  fullName: string;
  email: string;
  role: string;
  lastLogin: string | null;
  createdAt: string;
}) {
  const lastLoginStr = lastLogin
    ? new Date(lastLogin).toLocaleDateString("fr-CA", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Jamais";

  const memberSince = new Date(createdAt).toLocaleDateString("fr-CA", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative rounded-2xl vnk-gradient text-white overflow-hidden">
      <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/5 hidden sm:block" />
      <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5 hidden sm:block" />

      <div className="relative p-5 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-white/20">
          <AvatarFallback className="bg-white/20 text-white text-xl sm:text-2xl font-bold">
            {initials(fullName || email)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
            {fullName}
          </h1>
          <p className="text-white/70 text-sm mt-0.5">{email}</p>
          <Badge className="mt-2 bg-white/15 hover:bg-white/20 text-white border-0 text-xs">
            <Shield className="h-3 w-3 mr-1" />
            {ROLE_LABELS[role] ?? role}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-3 sm:flex-col sm:items-end text-xs text-white/60">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Derniere connexion : {lastLoginStr}
          </span>
          <span>Membre depuis {memberSince}</span>
        </div>
      </div>
    </div>
  );
}
