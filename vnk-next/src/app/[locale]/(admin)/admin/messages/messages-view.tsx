"use client";
import { useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Conv = {
  id: number;
  fullName: string;
  companyName: string | null;
  messages: {
    content: string | null;
    isRead: boolean;
    sender: string;
    createdAt: Date;
  }[];
  _count: { messages: number };
};

export function MessagesView({ conversations }: { conversations: Conv[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) =>
    c.fullName.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Messagerie" subtitle="Chat portail, emails entrants et sortants" icon={MessageSquare} action={{ label: "Nouveau message" }} />

      <div className="grid md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)]">
        {/* ── Liste conversations ────────────────────── */}
        <Card className="overflow-hidden flex flex-col">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un client…"
                className="pl-10"
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {filtered.map((c) => {
              const lastMsg = c.messages[0];
              return (
                <li
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    "p-3 border-b cursor-pointer hover:bg-accent transition-colors",
                    selected === c.id && "bg-accent"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="vnk-gradient text-white text-xs">
                        {initials(c.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm truncate">{c.fullName}</span>
                        {c._count.messages > 0 && (
                          <Badge variant="destructive" className="text-[9px] px-1.5">
                            {c._count.messages}
                          </Badge>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {lastMsg.content ?? ""}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* ── Conversation sélectionnée ───────────────── */}
        <Card className="overflow-hidden flex flex-col">
          <CardContent className="flex-1 p-8 flex items-center justify-center text-center">
            <div>
              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {selected
                  ? "Chargement de la conversation…"
                  : "Sélectionnez une conversation"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
