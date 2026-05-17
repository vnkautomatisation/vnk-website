// Annuaire interne : tous les collègues actifs.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Users, Mail, Phone, Crown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MyTeamPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const me = await prisma.admin.findUnique({ where: { id: adminId }, select: { teamId: true } });

  const [colleagues, teamMembers] = await Promise.all([
    prisma.admin.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true, fullName: true, email: true, phone: true, avatarUrl: true,
        title: true, department: true,
        position: { select: { name: true, color: true } },
        team: { select: { id: true, name: true, color: true } },
      },
    }),
    me?.teamId
      ? prisma.admin.findMany({
          where: { teamId: me.teamId, isActive: true },
          select: {
            id: true, fullName: true, email: true, phone: true, avatarUrl: true,
            title: true,
            team: { select: { name: true, leadAdminId: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      {teamMembers.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Mon équipe ({teamMembers.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {teamMembers.map((m) => (
              <PersonCard key={m.id} person={m} highlight isLead={m.team?.leadAdminId === m.id} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h1 className="text-xl font-bold flex items-center gap-2 mb-2">
          <Users className="h-5 w-5 text-[#0F2D52]" />Annuaire interne ({colleagues.length})
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {colleagues.map((c) => <PersonCard key={c.id} person={c} />)}
        </div>
      </section>
    </div>
  );
}

function PersonCard({ person, highlight, isLead }: {
  person: {
    id: number; fullName: string | null; email: string; phone: string | null;
    avatarUrl: string | null; title: string | null; department?: string | null;
    position?: { name: string; color: string | null } | null;
    team?: { name: string; color?: string | null } | null;
  };
  highlight?: boolean;
  isLead?: boolean;
}) {
  const initials = (person.fullName || person.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <Card className={`p-4 ${highlight ? "ring-2 ring-[#0F2D52]/20" : ""}`}>
      <div className="flex items-start gap-3">
        <div
          className="h-12 w-12 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={person.avatarUrl ? { backgroundImage: `url(${person.avatarUrl})`, backgroundSize: "cover" } : undefined}
        >
          {!person.avatarUrl && initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm truncate">{person.fullName || person.email}</h3>
            {isLead && <Crown className="h-3.5 w-3.5 text-amber-500" />}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {person.title || person.position?.name || "—"}
          </p>
          {(person.department || person.team) && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {person.department && <Badge variant="outline" className="text-[10px]">{person.department}</Badge>}
              {person.team && <Badge variant="outline" className="text-[10px]" style={person.team.color ? { borderColor: `${person.team.color}66`, color: person.team.color } : undefined}>{person.team.name}</Badge>}
            </div>
          )}
          <div className="mt-2 space-y-0.5 text-xs">
            <a href={`mailto:${person.email}`} className="flex items-center gap-1.5 text-[#0F2D52] hover:underline truncate">
              <Mail className="h-3 w-3 shrink-0" />{person.email}
            </a>
            {person.phone && (
              <a href={`tel:${person.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Phone className="h-3 w-3" />{person.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
