"use server";
// Server Actions — gestion du contenu CMS : BlogPost, FaqItem, Testimonial.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session.user.adminId!;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

// ═══════════════════════════════════════════════════════════
// BLOG POSTS
// ═══════════════════════════════════════════════════════════
const postSchema = z.object({
  locale: z.enum(["fr", "en"]).default("fr"),
  slug: z.string().max(120).optional(),
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).nullable().optional(),
  contentHtml: z.string().max(200000),
  coverImageUrl: z.string().nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  seoTitle: z.string().max(120).nullable().optional(),
  seoDescription: z.string().max(300).nullable().optional(),
});

export async function createPostAction(input: z.infer<typeof postSchema>): Promise<Result<{ id: number }>> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const slug = parsed.data.slug?.trim() || slugify(parsed.data.title);
  const existing = await prisma.blogPost.findUnique({ where: { slug_locale: { slug, locale: parsed.data.locale } } });
  if (existing) return { success: false, error: "Un article avec ce slug existe déjà dans cette langue" };

  const created = await prisma.blogPost.create({
    data: {
      locale: parsed.data.locale,
      slug,
      title: parsed.data.title,
      excerpt: parsed.data.excerpt ?? null,
      contentHtml: parsed.data.contentHtml,
      coverImageUrl: parsed.data.coverImageUrl ?? null,
      category: parsed.data.category ?? null,
      tags: parsed.data.tags ?? [],
      status: parsed.data.status,
      publishedAt: parsed.data.status === "published" ? new Date() : null,
      authorId: adminId,
      seoTitle: parsed.data.seoTitle ?? null,
      seoDescription: parsed.data.seoDescription ?? null,
    },
    select: { id: true },
  });

  await logAudit({ adminId, action: "create", entityType: "blog_post", entityId: created.id, changes: { title: parsed.data.title, status: parsed.data.status } });
  revalidatePath("/admin/settings/content");
  revalidatePath("/blog");
  return { success: true, data: { id: created.id } };
}

export async function updatePostAction(input: z.infer<typeof postSchema> & { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const { id, slug: inSlug, ...rest } = input;
  const parsed = postSchema.safeParse(rest);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const before = await prisma.blogPost.findUnique({ where: { id } });
  if (!before) return { success: false, error: "Article introuvable" };
  const slug = inSlug?.trim() || before.slug;

  const willPublish = before.status !== "published" && parsed.data.status === "published";
  await prisma.blogPost.update({
    where: { id },
    data: {
      ...parsed.data,
      slug,
      excerpt: parsed.data.excerpt ?? null,
      coverImageUrl: parsed.data.coverImageUrl ?? null,
      category: parsed.data.category ?? null,
      tags: parsed.data.tags ?? [],
      seoTitle: parsed.data.seoTitle ?? null,
      seoDescription: parsed.data.seoDescription ?? null,
      publishedAt: willPublish ? new Date() : before.publishedAt,
    },
  });

  await logAudit({ adminId, action: "update", entityType: "blog_post", entityId: id });
  revalidatePath("/admin/settings/content");
  revalidatePath(`/blog/${slug}`);
  return { success: true };
}

export async function deletePostAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  await prisma.blogPost.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "blog_post", entityId: input.id });
  revalidatePath("/admin/settings/content");
  revalidatePath("/blog");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// FAQ ITEMS
// ═══════════════════════════════════════════════════════════
const faqSchema = z.object({
  locale: z.enum(["fr", "en"]).default("fr"),
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(10000),
  category: z.string().max(80).nullable().optional(),
  isPublished: z.boolean().default(true),
});

export async function createFaqAction(input: z.infer<typeof faqSchema>): Promise<Result<{ id: number }>> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const max = await prisma.faqItem.aggregate({ _max: { sortOrder: true }, where: { locale: parsed.data.locale } });
  const created = await prisma.faqItem.create({
    data: { ...parsed.data, category: parsed.data.category ?? null, sortOrder: (max._max.sortOrder ?? 0) + 10 },
    select: { id: true },
  });

  await logAudit({ adminId, action: "create", entityType: "faq_item", entityId: created.id });
  revalidatePath("/admin/settings/content");
  revalidatePath("/faq");
  return { success: true, data: { id: created.id } };
}

export async function updateFaqAction(input: z.infer<typeof faqSchema> & { id: number; sortOrder?: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const { id, sortOrder, ...rest } = input;
  await prisma.faqItem.update({
    where: { id },
    data: { ...rest, category: rest.category ?? null, sortOrder },
  });
  await logAudit({ adminId, action: "update", entityType: "faq_item", entityId: id });
  revalidatePath("/admin/settings/content");
  revalidatePath("/faq");
  return { success: true };
}

export async function deleteFaqAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  await prisma.faqItem.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "faq_item", entityId: input.id });
  revalidatePath("/admin/settings/content");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// TESTIMONIALS
// ═══════════════════════════════════════════════════════════
const testimonialSchema = z.object({
  clientName: z.string().min(1).max(120),
  clientCompany: z.string().max(120).nullable().optional(),
  clientTitle: z.string().max(120).nullable().optional(),
  content: z.string().min(1).max(2000),
  rating: z.number().int().min(1).max(5).default(5),
  avatarUrl: z.string().nullable().optional(),
  isFeatured: z.boolean().default(false),
  isApproved: z.boolean().default(false),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export async function createTestimonialAction(input: z.infer<typeof testimonialSchema>): Promise<Result<{ id: number }>> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const created = await prisma.testimonial.create({
    data: {
      ...parsed.data,
      clientCompany: parsed.data.clientCompany ?? null,
      clientTitle: parsed.data.clientTitle ?? null,
      avatarUrl: parsed.data.avatarUrl ?? null,
    },
    select: { id: true },
  });
  await logAudit({ adminId, action: "create", entityType: "testimonial", entityId: created.id });
  revalidatePath("/admin/settings/content");
  revalidatePath("/");
  return { success: true, data: { id: created.id } };
}

export async function updateTestimonialAction(input: z.infer<typeof testimonialSchema> & { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const { id, ...rest } = input;
  await prisma.testimonial.update({
    where: { id },
    data: {
      ...rest,
      clientCompany: rest.clientCompany ?? null,
      clientTitle: rest.clientTitle ?? null,
      avatarUrl: rest.avatarUrl ?? null,
    },
  });
  await logAudit({ adminId, action: "update", entityType: "testimonial", entityId: id });
  revalidatePath("/admin/settings/content");
  return { success: true };
}

export async function deleteTestimonialAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  await prisma.testimonial.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "testimonial", entityId: input.id });
  revalidatePath("/admin/settings/content");
  return { success: true };
}
