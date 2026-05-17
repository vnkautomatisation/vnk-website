"use client";
import { useState } from "react";
import { FileText, Calendar, Search, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MarkdownView } from "@/components/admin/markdown-view";
import { cn } from "@/lib/utils";

type Policy = {
  id: number; title: string; version: string;
  bodyMarkdown: string; effectiveFrom: string;
  publisher: { fullName: string | null; email: string };
};

export function PoliciesEmployeeView({ policies }: { policies: Policy[] }) {
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const filtered = search
    ? policies.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.bodyMarkdown.toLowerCase().includes(search.toLowerCase())
      )
    : policies;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#0F2D52]" />Politiques RH
        </h1>
        <p className="text-sm text-muted-foreground">Politiques internes en vigueur. Cliquez sur une politique pour la lire.</p>
      </div>

      {policies.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une politique…"
            className="pl-9"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {search ? `Aucune politique ne correspond à « ${search} »` : "Aucune politique publiée."}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const isOpen = openId === p.id;
            return (
              <Card key={p.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : p.id)}
                  className="w-full p-4 flex items-start justify-between gap-3 hover:bg-muted/30 transition text-left"
                  aria-expanded={isOpen}
                  aria-controls={`policy-body-${p.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-base">{p.title}</h2>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">v{p.version}</Badge>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        En vigueur depuis le {new Date(p.effectiveFrom).toLocaleDateString("fr-CA")}
                      </span>
                      <span>· {p.publisher?.fullName || p.publisher?.email || "VNK"}</span>
                    </p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform mt-1", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div id={`policy-body-${p.id}`} className="px-4 pb-4 border-t pt-4">
                    <MarkdownView>{p.bodyMarkdown}</MarkdownView>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
