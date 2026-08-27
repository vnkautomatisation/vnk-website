"use client";
// Vue Contenu — 3 sous-onglets : Blog · FAQ · Témoignages.
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Newspaper, ChevronLeft, Plus, MoreHorizontal, Edit, Trash2,
  FileText, HelpCircle, MessageSquareQuote, Eye, EyeOff, Star, Power,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PostDialog } from "./post-dialog";
import { FaqDialog } from "./faq-dialog";
import { TestimonialDialog } from "./testimonial-dialog";
import {
  deletePostAction, deleteFaqAction, deleteTestimonialAction,
  updatePostAction, updateFaqAction, updateTestimonialAction,
} from "@/app/actions/cms";

export type PostRow = {
  id: number; locale: string; slug: string; title: string;
  excerpt: string | null; contentHtml: string;
  coverImageUrl: string | null; category: string | null;
  tags: string[]; status: string;
  publishedAt: string | null; viewCount: number;
  seoTitle: string | null; seoDescription: string | null;
  createdAt: string; updatedAt: string;
};
export type FaqRow = {
  id: number; locale: string; question: string; answer: string;
  category: string | null; sortOrder: number; isPublished: boolean;
  createdAt: string; updatedAt: string;
};
export type TestimonialRow = {
  id: number; clientName: string; clientCompany: string | null; clientTitle: string | null;
  content: string; rating: number; avatarUrl: string | null;
  isFeatured: boolean; isApproved: boolean; locale: string;
  createdAt: string;
};

type Tab = "blog" | "faq" | "testimonials";

export function ContentView({
  posts, faqs, testimonials,
}: {
  posts: PostRow[];
  faqs: FaqRow[];
  testimonials: TestimonialRow[];
}) {
  const t = useTranslations("admin.content");
  const tc = useTranslations("common");
  const router = useRouter();
  const [tabKey, setTab] = useState<Tab>("blog");

  const [postDialog, setPostDialog] = useState<{ open: boolean; post: PostRow | null }>({ open: false, post: null });
  const [faqDialog, setFaqDialog] = useState<{ open: boolean; faq: FaqRow | null }>({ open: false, faq: null });
  const [testimonialDialog, setTestimonialDialog] = useState<{ open: boolean; t: TestimonialRow | null }>({ open: false, t: null });
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "post" | "faq" | "testimonial"; id: number; label: string } | null>(null);

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    let r: { success: boolean; error?: string };
    if (confirmDelete.kind === "post") r = await deletePostAction({ id: confirmDelete.id });
    else if (confirmDelete.kind === "faq") r = await deleteFaqAction({ id: confirmDelete.id });
    else r = await deleteTestimonialAction({ id: confirmDelete.id });
    if (r.success) { toast.success(t("supprime")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
    setConfirmDelete(null);
  };

  const togglePostStatus = async (p: PostRow) => {
    const next = p.status === "published" ? "draft" : "published";
    const r = await updatePostAction({
      id: p.id, locale: p.locale as "fr" | "en", slug: p.slug, title: p.title,
      excerpt: p.excerpt, contentHtml: p.contentHtml, coverImageUrl: p.coverImageUrl,
      category: p.category, tags: p.tags,
      status: next as "draft" | "published" | "archived",
      seoTitle: p.seoTitle, seoDescription: p.seoDescription,
    });
    if (r.success) { toast.success(next === "published" ? t("publie") : t("depublie")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
  };

  const toggleFaqPublished = async (f: FaqRow) => {
    const r = await updateFaqAction({
      id: f.id, locale: f.locale as "fr" | "en", question: f.question,
      answer: f.answer, category: f.category, isPublished: !f.isPublished,
    });
    if (r.success) { toast.success(f.isPublished ? t("masque") : t("publie")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
  };

  const toggleTestimonialApproved = async (row: TestimonialRow) => {
    const r = await updateTestimonialAction({
      id: row.id, clientName: row.clientName, clientCompany: row.clientCompany, clientTitle: row.clientTitle,
      content: row.content, rating: row.rating, avatarUrl: row.avatarUrl,
      isFeatured: row.isFeatured, isApproved: !row.isApproved, locale: row.locale as "fr" | "en",
    });
    if (r.success) { toast.success(row.isApproved ? t("non_approuve") : t("approuve")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
  };

  const toggleTestimonialFeatured = async (row: TestimonialRow) => {
    const r = await updateTestimonialAction({
      id: row.id, clientName: row.clientName, clientCompany: row.clientCompany, clientTitle: row.clientTitle,
      content: row.content, rating: row.rating, avatarUrl: row.avatarUrl,
      isFeatured: !row.isFeatured, isApproved: row.isApproved, locale: row.locale as "fr" | "en",
    });
    if (r.success) { toast.success(row.isFeatured ? t("retire_vitrine") : t("mis_vitrine")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
  };

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { key: "blog", label: t("blog"), icon: FileText, count: posts.length },
    { key: "faq", label: "FAQ", icon: HelpCircle, count: faqs.length },
    { key: "testimonials", label: t("temoignages"), icon: MessageSquareQuote, count: testimonials.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-teal-500 shrink-0">
          <Newspaper className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("contenu_public")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("articles_blog_foire_questions_temoignages")}</p>
        </div>
      </div>

      <div className="border-b">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.key === tabKey;
            return (
              <button
                key={tab.key}
                onClick={() => setTab(tab.key)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2",
                  active ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />{tab.label}
                <Badge variant="secondary" className="text-[10px] ml-1">{tab.count}</Badge>
              </button>
            );
          })}
        </div>
      </div>


      {tabKey === "blog" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {t("n_publies_n_brouillons", { published: posts.filter((p) => p.status === "published").length, drafts: posts.filter((p) => p.status === "draft").length })}
            </p>
            <Button onClick={() => setPostDialog({ open: true, post: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />{t("nouvel_article_btn")}
            </Button>
          </div>
          <Card>
            <div className="divide-y">
              {posts.map((p) => (
                <div key={p.id} className="flex items-start gap-4 p-4 hover:bg-muted/40">
                  <div className="h-12 w-16 rounded-md overflow-hidden bg-muted shrink-0 border">
                    {p.coverImageUrl ? (

                      <img src={p.coverImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center"><FileText className="h-4 w-4 text-muted-foreground/40" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{p.title}</p>
                      <Badge variant="outline" className="text-[10px] uppercase">{p.locale}</Badge>
                      {p.status === "published" ? (
                        <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">{t("publie")}</Badge>
                      ) : p.status === "archived" ? (
                        <Badge className="text-[10px] bg-gray-500 hover:bg-gray-500">{t("archive")}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">{t("brouillon")}</Badge>
                      )}
                      {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">/{p.slug}</p>
                    {p.excerpt && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.excerpt}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      <span>{new Date(p.updatedAt).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span>{p.viewCount} vue{p.viewCount > 1 ? "s" : ""}</span>
                      {p.tags.length > 0 && <span>{p.tags.length} tag{p.tags.length > 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setPostDialog({ open: true, post: p })}><Edit className="h-4 w-4 mr-2" />{tc("edit")}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => togglePostStatus(p)}>
                        {p.status === "published" ? (<><EyeOff className="h-4 w-4 mr-2" />{t("depublier")}</>) : (<><Eye className="h-4 w-4 mr-2" />{t("publier")}</>)}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "post", id: p.id, label: p.title })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              {posts.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">{t("aucun_article_cliquez_nouvel_article")}</p>}
            </div>
          </Card>
        </div>
      )}


      {tabKey === "faq" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{faqs.filter((f) => f.isPublished).length} visible{faqs.filter((f) => f.isPublished).length > 1 ? "s" : ""} sur {faqs.length}</p>
            <Button onClick={() => setFaqDialog({ open: true, faq: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />Nouvelle question
            </Button>
          </div>
          <Card>
            <div className="divide-y">
              {faqs.map((f) => (
                <div key={f.id} className={cn("flex items-start gap-4 p-4 hover:bg-muted/40", !f.isPublished && "opacity-60")}>
                  <div className="h-9 w-9 rounded-lg bg-[#0F2D52] text-white flex items-center justify-center shrink-0">
                    <HelpCircle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{f.question}</p>
                      <Badge variant="outline" className="text-[10px] uppercase">{f.locale}</Badge>
                      {!f.isPublished && <Badge variant="secondary" className="text-[10px]">{t("masque")}</Badge>}
                      {f.category && <Badge variant="outline" className="text-[10px]">{f.category}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.answer.replace(/<[^>]+>/g, "")}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setFaqDialog({ open: true, faq: f })}><Edit className="h-4 w-4 mr-2" />{tc("edit")}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleFaqPublished(f)}><Power className="h-4 w-4 mr-2" />{f.isPublished ? t("masquer") : t("publier")}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "faq", id: f.id, label: f.question })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              {faqs.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">{t("aucune_question_ajoutez_premiere_faq")}</p>}
            </div>
          </Card>
        </div>
      )}


      {tabKey === "testimonials" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {t("temoignages_approuves_vitrine", { approved: testimonials.filter((r) => r.isApproved).length, featured: testimonials.filter((r) => r.isFeatured).length })}
            </p>
            <Button onClick={() => setTestimonialDialog({ open: true, t: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />{t("content_view_nouveau_temoignage")}</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {testimonials.map((row) => (
              <Card key={row.id} className={cn(!row.isApproved && "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#0F2D52] text-white flex items-center justify-center font-semibold text-sm shrink-0">
                      {row.avatarUrl ? (

                        <img src={row.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        row.clientName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{row.clientName}</p>
                        <Badge variant="outline" className="text-[10px] uppercase">{row.locale}</Badge>
                        {row.isFeatured && <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500"><Star className="h-2.5 w-2.5 mr-0.5" />{t("vitrine")}</Badge>}
                        {!row.isApproved && <Badge variant="secondary" className="text-[10px]">{t("attente")}</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {row.clientTitle && `${row.clientTitle} · `}{row.clientCompany}
                      </p>
                      <div className="flex gap-0.5 mt-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("h-3 w-3", i < row.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30")} />
                        ))}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setTestimonialDialog({ open: true, t: row })}><Edit className="h-4 w-4 mr-2" />{tc("edit")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleTestimonialApproved(row)}>
                          {row.isApproved ? <><EyeOff className="h-4 w-4 mr-2" />{t("retirer")}</> : <><Eye className="h-4 w-4 mr-2" />{t("approuver")}</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleTestimonialFeatured(row)}>
                          <Star className="h-4 w-4 mr-2" />{row.isFeatured ? t("retirer_vitrine") : t("mettre_vitrine")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "testimonial", id: row.id, label: row.clientName })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3 italic">&laquo; {row.content} &raquo;</p>
                </CardContent>
              </Card>
            ))}
            {testimonials.length === 0 && (
              <p className="col-span-full p-8 text-center text-sm text-muted-foreground">{t("aucun_temoignage")}</p>
            )}
          </div>
        </div>
      )}


      <PostDialog
        open={postDialog.open}
        onOpenChange={(open) => setPostDialog({ open, post: open ? postDialog.post : null })}
        post={postDialog.post}
        onSaved={() => router.refresh()}
      />
      <FaqDialog
        open={faqDialog.open}
        onOpenChange={(open) => setFaqDialog({ open, faq: open ? faqDialog.faq : null })}
        faq={faqDialog.faq}
        onSaved={() => router.refresh()}
      />
      <TestimonialDialog
        open={testimonialDialog.open}
        onOpenChange={(open) => setTestimonialDialog({ open, t: open ? testimonialDialog.t : null })}
        testimonial={testimonialDialog.t}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Supprimer ${confirmDelete?.label} ?`}
        description={t("action_irreversible")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
