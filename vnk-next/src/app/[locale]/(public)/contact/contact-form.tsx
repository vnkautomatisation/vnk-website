"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ContactForm() {
  const t = useTranslations("contact.form");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    startTransition(async () => {
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Erreur");
        toast.success(t("success"));
        form.reset();
      } catch {
        toast.error(t("error"));
      }
    });
  };

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot — caché visuellement mais accessible aux bots */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            style={{ position: "absolute", left: "-9999px" }}
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">{t("name")} *</Label>
              <Input
                id="contact-name"
                name="name"
                required
                autoComplete="name"
                placeholder="Jean Tremblay"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-company">{t("company")}</Label>
              <Input
                id="contact-company"
                name="company"
                autoComplete="organization"
                placeholder="Industries XYZ"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-email">{t("email")} *</Label>
              <Input
                id="contact-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="jean@exemple.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">{t("phone")}</Label>
              <Input
                id="contact-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="418-555-1234"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-service">{t("service")}</Label>
              <Select name="service">
                <SelectTrigger id="contact-service">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="support-plc">Support PLC</SelectItem>
                  <SelectItem value="audit">Audit technique</SelectItem>
                  <SelectItem value="documentation">Documentation</SelectItem>
                  <SelectItem value="refactoring">Refactorisation PLC</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-plc-brand">{t("plc_brand")}</Label>
              <Select name="plcBrand">
                <SelectTrigger id="contact-plc-brand">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="siemens">Siemens</SelectItem>
                  <SelectItem value="rockwell">Rockwell / Allen-Bradley</SelectItem>
                  <SelectItem value="br">B&amp;R</SelectItem>
                  <SelectItem value="schneider">Schneider</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-message">{t("message")} *</Label>
            <Textarea
              id="contact-message"
              name="message"
              required
              rows={5}
              placeholder="Décrivez votre besoin…"
              minLength={10}
              maxLength={5000}
            />
          </div>

          <Button type="submit" disabled={pending} size="lg" className="w-full sm:w-auto">
            {pending ? t("sending") : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
