"use client";
// Vue Contenu — 3 sous-onglets : Blog · FAQ · Témoignages.
import { useState } from "react";
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
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("blog");

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
    if (r.success) { toast.success("Supprimé"); router.refresh(); }
    else toast.error(r.error || "Erreur");
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
    if (r.success) { toast.success(next === "published" ? "Publié" : "Dépublié"); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };

  const toggleFaqPublished = async (f: FaqRow) => {
    const r = await updateFaqAction({
      id: f.id, locale: f.locale as "fr" | "en", question: f.question,
      answer: f.answer, category: f.category, isPublished: !f.isPublished,
    });
    if (r.success) { toast.success(f.isPublished ? "Masqué" : "Publié"); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };

  const toggleTestimonialApproved = async (t: TestimonialRow) => {
    const r = await updateTestimonialAction({
      id: t.id, clientName: t.clientName, clientCompany: t.clientCompany, clientTitle: t.clientTitle,
      content: t.content, rating: t.rating, avatarUrl: t.avatarUrl,
      isFeatured: t.isFeatured, isApproved: !t.isApproved, locale: t.locale as "fr" | "en",
    });
    if (r.success) { toast.success(t.isApproved ? "Non approuvé" : "Approuvé"); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };

  const toggleTestimonialFeatured = async (t: TestimonialRow) => {
    const r = await updateTestimonialAction({
      id: t.id, clientName: t.clientName, clientCompany: t.clientCompany, clientTitle: t.clientTitle,
      content: t.content, rating: t.rating, avatarUrl: t.avatarUrl,
      isFeatured: !t.isFeatured, isApproved: t.isApproved, locale: t.locale as "fr" | "en",
    });
    if (r.success) { toast.success(t.isFeatured ? "Retiré de la vitrine" : "Mis en vitrine"); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { key: "blog", label: "Blog", icon: FileText, count: posts.length },
    { key: "faq", label: "FAQ", icon: HelpCircle, count: faqs.length },
    { key: "testimonials", label: "Témoignages", icon: MessageSquareQuote, count: testimonials.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label="Retour"><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-teal-500 shrink-0">
          <Newspaper className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Contenu public</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Articles de blog, foire aux questions et témoignages clients</p>
        </div>
      </div>

      <div className="border-b">
        <div className="flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2",
                  active ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />{t.label}
                <Badge variant="secondary" className="text-[10px] ml-1">{t.count}</Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* BLOG */}
      {tab === "blog" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {posts.filter((p) => p.status === "published").length} publié{posts.filter((p) => p.status === "published").length > 1 ? "s" : ""} · {posts.filter((p) => p.status === "draft").length} brouillon{posts.filter((p) => p.status === "draft").length > 1 ? "s" : ""}
            </p>
            <Button onClick={() => setPostDialog({ open: true, post: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />Nouvel article
            </Button>
          </div>
          <Card>
            <div className="divide-y">
              {posts.map((p) => (
                <div key={p.id} className="flex items-start gap-4 p-4 hover:bg-muted/40">
                  <div className="h-12 w-16 rounded-md overflow-hidden bg-muted shrink-0 border">
                    {p.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
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
                        <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">Publié</Badge>
                      ) : p.status === "archived" ? (
                        <Badge className="text-[10px] bg-gray-500 hover:bg-gray-500">Archivé</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Brouillon</Badge>
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
                      <DropdownMenuItem onClick={() => setPostDialog({ open: true, post: p })}><Edit className="h-4 w-4 mr-2" />Modifier</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => togglePostStatus(p)}>
                        {p.status === "published" ? (<><EyeOff className="h-4 w-4 mr-2" />Dépublier</>) : (<><Eye className="h-4 w-4 mr-2" />Publier</>)}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "post", id: p.id, label: p.title })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />Supprimer</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              {posts.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Aucun article. Cliquez sur « Nouvel article » pour commencer.</p>}
            </div>
          </Card>
        </div>
      )}

      {/* FAQ */}
      {tab === "faq" && (
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
                      {!f.isPublished && <Badge variant="secondary" className="text-[10px]">Masqué</Badge>}
                      {f.category && <Badge variant="outline" className="text-[10px]">{f.category}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.answer.replace(/<[^>]+>/g, "")}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setFaqDialog({ open: true, faq: f })}><Edit className="h-4 w-4 mr-2" />Modifier</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleFaqPublished(f)}><Power className="h-4 w-4 mr-2" />{f.isPublished ? "Masquer" : "Publier"}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "faq", id: f.id, label: f.question })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />Supprimer</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              {faqs.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Aucune question. Ajoutez votre première FAQ.</p>}
            </div>
          </Card>
        </div>
      )}

      {/* TESTIMONIALS */}
      {tab === "testimonials" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {testimonials.filter((t) => t.isApproved).length} approuvé{testimonials.filter((t) => t.isApproved).length > 1 ? "s" : ""} · {testimonials.filter((t) => t.isFeatured).length} en vitrine
            </p>
            <Button onClick={() => setTestimonialDialog({ open: true, t: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />Nouveau témoignage
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {testimonials.map((t) => (
              <Card key={t.id} className={cn(!t.isApproved && "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#0F2D52] text-white flex items-center justify-center font-semibold text-sm shrink-0">
                      {t.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        t.clientName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{t.clientName}</p>
                        <Badge variant="outline" className="text-[10px] uppercase">{t.locale}</Badge>
                        {t.isFeatured && <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500"><Star className="h-2.5 w-2.5 mr-0.5" />Vitrine</Badge>}
                        {!t.isApproved && <Badge variant="secondary" className="text-[10px]">En attente</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {t.clientTitle && `${t.clientTitle} · `}{t.clientCompany}
                      </p>
                      <div className="flex gap-0.5 mt-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("h-3 w-3", i < t.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30")} />
                        ))}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setTestimonialDialog({ open: true, t })}><Edit className="h-4 w-4 mr-2" />Modifier</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleTestimonialApproved(t)}>
                          {t.isApproved ? <><EyeOff className="h-4 w-4 mr-2" />Retirer</> : <><Eye className="h-4 w-4 mr-2" />Approuver</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleTestimonialFeatured(t)}>
                          <Star className="h-4 w-4 mr-2" />{t.isFeatured ? "Retirer vitrine" : "Mettre en vitrine"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "testimonial", id: t.id, label: t.clientName })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />Supprimer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3 italic">&laquo; {t.content} &raquo;</p>
                </CardContent>
              </Card>
            ))}
            {testimonials.length === 0 && (
              <p className="col-span-full p-8 text-center text-sm text-muted-foreground">Aucun témoignage.</p>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
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
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
