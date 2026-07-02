// Couche client du module Rapports vers Google Slides (voir app/api/slides/route.ts).
// Toutes les fonctions sont "best-effort" : en cas d'échec (dossiers Drive non configurés,
// réseau, API non disponible), elles retournent null/false et n'interrompent jamais le flux
// localStorage — voir CLAUDE.md § Module Rapports.

import type { FormatRapport } from "@/lib/rapports-data"

const API_URL = "/api/slides"

export async function creerSlide(
  segments: string[],
  titre: string,
  format?: FormatRapport
): Promise<{ presentationId: string; url: string } | null> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "creer", segments, titre, format }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.warn("[rapports] création Slides indisponible", e)
    return null
  }
}

// Retourne le { presentationId, url } effectif après synchronisation — identique à
// `presentationId` en temps normal, mais DIFFÉRENT si `nouveauFichier` a dû forcer la création
// d'une nouvelle présentation (changement de format 16:9 ↔ A4, cf. lib/google-slides-server.ts
// § reconstruireSlides — l'API Slides ne permet pas de redimensionner un fichier existant).
// L'appelant doit alors mettre à jour slideId/slideUrl sur le Brouillon avec le résultat.
export async function syncSlide(
  presentationId: string,
  segments: string[],
  options?: { format?: FormatRapport; nouveauFichier?: boolean; titre?: string }
): Promise<{ presentationId: string; url: string } | null> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", presentationId, segments, ...options }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.warn("[rapports] synchronisation Slides indisponible", e)
    return null
  }
}

export async function lireSlide(presentationId: string): Promise<string[] | null> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lire", presentationId }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.segments ?? null
  } catch (e) {
    console.warn("[rapports] lecture Slides indisponible", e)
    return null
  }
}

export async function validerRapport(presentationId: string): Promise<boolean> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "valider", presentationId }),
    })
    return res.ok
  } catch (e) {
    console.warn("[rapports] validation Slides indisponible", e)
    return false
  }
}

export function pdfDownloadUrl(presentationId: string): string {
  return `${API_URL}?action=exportPdf&presentationId=${encodeURIComponent(presentationId)}`
}

/** Supprime définitivement le fichier Google Slides sur Drive (utilisé par le bouton
 * "Supprimer" du dashboard, après confirmation utilisateur — voir app/rapports/page.tsx). */
export async function supprimerSlide(presentationId: string): Promise<boolean> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "supprimer", presentationId }),
    })
    return res.ok
  } catch (e) {
    console.warn("[rapports] suppression Slides indisponible", e)
    return false
  }
}
