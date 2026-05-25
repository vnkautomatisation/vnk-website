"use client";
// Composant unique qui combine le feedback navigation à 2 niveaux pour tout le projet.
// À monter dans CHAQUE layout racine (admin, portail client, site public, login pages).
//
// 1. NavigationProgress = barre fine navy en haut (apparaît dès 200ms)
// 2. NavigationOverlay = overlay sombre + blur centré (apparaît dès 300ms)
//
// Théme VNK navy #0F2D52 appliqué partout — cohérence visuelle complète.
//
// IMPORTANT : à wrapper dans <Suspense> côté caller car NavigationProgress
// utilise useSearchParams (Next.js 15 requirement).
import { NavigationProgress } from "@/components/admin/navigation-progress";
import { NavigationOverlay } from "@/components/admin/navigation-overlay";

export function NavigationFeedback() {
  return (
    <>
      <NavigationProgress />
      <NavigationOverlay />
    </>
  );
}
