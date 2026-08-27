"use client";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";

// ─────────────────────────────────────────────────────────
// Composant générique : section avec mode lecture par défaut
// et bouton "Modifier" qui bascule en mode édition.
// L'utilisateur clique « Enregistrer » pour valider ou « Annuler »
// pour revenir en lecture sans sauvegarder.
// ─────────────────────────────────────────────────────────

export function EditableSection({
  title,
  icon: Icon,
  description,
  readView,
  editView,
  onSave,
  saveLabel,
  cancelLabel,
  editLabel,
  saving = false,
  className,
  alwaysEditable = false,
  headerExtra,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  readView: ReactNode;
  editView: ReactNode;
  onSave: () => void | Promise<void>;
  saveLabel?: string;
  cancelLabel?: string;
  editLabel?: string;
  saving?: boolean;
  className?: string;
  alwaysEditable?: boolean;
  headerExtra?: ReactNode;
}) {
  const t = useTranslations("admin.profile.banner");
  const [editing, setEditing] = useState(false);
  const isEditing = alwaysEditable || editing;

  const handleSave = async () => {
    await onSave();
    setEditing(false);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4" />}
              {title}
            </CardTitle>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {headerExtra}
            {!isEditing && !alwaysEditable && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="h-8">
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline ml-1">{editLabel ?? t("modifier")}</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? editView : readView}
        {isEditing && !alwaysEditable && (
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t">
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Check className="h-3.5 w-3.5" />
              {saving ? t("enregistrement") : saveLabel ?? t("enregistrer")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              <X className="h-3.5 w-3.5" />
              {cancelLabel ?? t("annuler")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Ligne « clé / valeur » pour le mode lecture ─────────
export function ReadField({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  const t = useTranslations("admin.profile.banner");
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2 border-b last:border-b-0">
      <span className="text-xs text-muted-foreground sm:text-sm">{label}</span>
      <span className={`text-sm font-medium break-words ${mono ? "font-mono" : ""}`}>
        {value || <span className="text-muted-foreground italic font-normal">{t("non_renseigne")}</span>}
      </span>
    </div>
  );
}
