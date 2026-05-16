// Settings · Contenu — Blog · FAQ · Témoignages.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ContentView } from "./content-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contenu — VNK" };

export default async function ContentPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

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
