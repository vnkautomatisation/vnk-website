// Settings · Contenu — Blog · FAQ · Témoignages.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ContentView } from "./content-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contenu — VNK" };

export default async function ContentPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write (ou blog.write) requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write") && !canAct(perms, "blog", "write") && !canAct(perms, "pages", "write") && !canAct(perms, "website", "write")) redirect("/admin");

  const [posts, faqs, testimonials] = await Promise.all([
    prisma.blogPost.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.faqItem.findMany({ orderBy: [{ locale: "asc" }, { sortOrder: "asc" }] }),
    prisma.testimonial.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <ContentView
      posts={JSON.parse(JSON.stringify(posts))}
      faqs={JSON.parse(JSON.stringify(faqs))}
      testimonials={JSON.parse(JSON.stringify(testimonials))}
    />
  );
}
