"use client";
// Dialog création/édition d'un BlogPost avec rich editor + meta SEO.
import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Search, Tag as TagIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RichEditor } from "@/components/admin/rich-editor";
import { createPostAction, updatePostAction } from "@/app/actions/cms";
import type { PostRow } from "./content-view";

export function PostDialog({
  open, onOpenChange, post, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: PostRow | null;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.content");
  const tc = useTranslations("common");
  const mode = post ? "edit" : "create";
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"content" | "seo">("content");

  const [locale, setLocale] = useState<"fr" | "en">("fr");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [contentHtml, setContentHtml] = useState("<p></p>");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [category, setCategory] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("content");
    if (post) {
      setLocale(post.locale as "fr" | "en");
      setSlug(post.slug);
      setTitle(post.title);
      setExcerpt(post.excerpt ?? "");
      setContentHtml(post.contentHtml);
      setCoverImageUrl(post.coverImageUrl ?? "");
      setCategory(post.category ?? "");
      setTagsText(post.tags.join(", "));
      setStatus(post.status as "draft" | "published" | "archived");
      setSeoTitle(post.seoTitle ?? "");
      setSeoDescription(post.seoDescription ?? "");
    } else {
      setLocale("fr"); setSlug(""); setTitle(""); setExcerpt("");
      setContentHtml("<p></p>"); setCoverImageUrl(""); setCategory("");
      setTagsText(""); setStatus("draft");
      setSeoTitle(""); setSeoDescription("");
    }
  }, [open, post]);

  const handleSave = () => {
    startTransition(async () => {
      const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        locale, slug: slug || undefined, title,
        excerpt: excerpt || null, contentHtml,
        coverImageUrl: coverImageUrl || null, category: category || null,
        tags, status,
        seoTitle: seoTitle || null, seoDescription: seoDescription || null,
      };
      const r = mode === "create"
        ? await createPostAction(payload)
        : await updatePostAction({ id: post!.id, ...payload });
      if (r.success) {
        toast.success(mode === "create" ? t("article_cree") : t("article_mis_jour"));
        onSaved(); onOpenChange(false);
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-white text-base">{mode === "create" ? t("nouvel_article") : post?.title}</DialogTitle>
            <p className="text-xs text-white/70">{t("article_blog")}</p>
          </div>
        </div>

        <div className="border-b px-6">
          <div className="flex gap-1">
            <button onClick={() => setTab("content")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "content" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground"}`}>
              {t("contenu_2")}
            </button>
            <button onClick={() => setTab("seo")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "seo" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground"}`}>
              <Search className="h-3.5 w-3.5 inline mr-1" />SEO
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {tab === "content" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("titre")}</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("pourquoi_automatiser")} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("langue")}</Label>
                  <Select value={locale} onValueChange={(v) => setLocale(v as "fr" | "en")}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">{t("francais")}</SelectItem>
                      <SelectItem value="en">{t("english")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("slug_url")}</Label>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t("auto_genere_depuis_titre")} className="mt-1 font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{tc("status")}</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t("brouillon")}</SelectItem>
                      <SelectItem value="published">{t("publie")}</SelectItem>
                      <SelectItem value="archived">{t("archive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("extrait_excerpt")}</Label>
                <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} maxLength={500} placeholder={t("resume_court_affiche_liste")} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("image_couverture_url")}</Label>
                <Input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." className="mt-1" />
                {coverImageUrl && (

                  <img src={coverImageUrl} alt="" className="mt-2 h-24 rounded-md border object-cover" />
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("categorie")}</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("automatisation")} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <TagIcon className="h-3 w-3 inline mr-1" />{t("post_dialog_tags_separes_par_virgule")}</Label>
                  <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder={t("iec61131_mappview_fanuc")} className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("contenu")}</Label>
                <div className="mt-1">
                  <RichEditor value={contentHtml} onChange={setContentHtml} rows={14} />
                </div>
              </div>
            </>
          )}

          {tab === "seo" && (
            <>
              <p className="text-xs text-muted-foreground">
                {t("optimisez_apos_affichage_google_partages")}
              </p>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("titre_seo_balise_lt_title")}</Label>
                <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={120} placeholder={title || t("herite_du_titre")} className="mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">{tc("chars_recommended", { count: seoTitle.length, max: 60 })}</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("description_seo_meta_description")}</Label>
                <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={3} maxLength={300} placeholder={excerpt || t("description_courte_moteurs_recherche")} className="mt-1 text-sm" />
                <p className="text-[10px] text-muted-foreground mt-1">{tc("chars_recommended", { count: seoDescription.length, max: 160 })}</p>
              </div>


              <div className="rounded-lg border p-3 bg-white">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{t("apercu_google")}</p>
                <p className="text-xs text-green-700">https://vnkautomatisation.ca › blog › {slug || "..."}</p>
                <p className="text-base text-blue-700 hover:underline cursor-pointer mt-0.5 line-clamp-1">{seoTitle || title || t("titre_article")}</p>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{seoDescription || excerpt || t("description")}</p>
              </div>
            </>
          )}
        </div>

        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={handleSave} disabled={pending || !title.trim()} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
            {pending ? "..." : mode === "create" ? t("creer") : t("enregistrer")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
