// Couche client des imports de template, de la mise en page assistée par IA et des suggestions
// visuelles (module Rapports). Voir app/api/rapports-template/route.ts. Ce sont des actions
// explicites de l'utilisateur qui attendent un retour — les erreurs sont levées, pas absorbées.

import type { DonneesGabarit, GabaritDiapositive, StyleRapport } from "@/lib/rapports-data"

export type SourceTemplate =
  | { type: "pdf"; base64: string }
  | { type: "slides"; presentationId: string }

async function poster<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/rapports-template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Échec de l'appel IA")
  return data
}

export function analyserTemplate(
  source: SourceTemplate,
  instruction: string | undefined,
  segments?: string[]
): Promise<{ style: StyleRapport; message: string; gabarits?: GabaritDiapositive[] }> {
  return poster({ action: "analyserTemplate", source, instruction, segments })
}

export function choisirDisposition(
  slideIndex: number,
  texteSlide: string,
  aUneImage: boolean,
  instruction?: string
): Promise<{ disposition: StyleRapport["disposition"]; message: string }> {
  return poster({ action: "choisirDisposition", slideIndex, texteSlide, aUneImage, instruction })
}

export interface SuggestionVisuelle {
  disposition: StyleRapport["disposition"]
  donnees?: DonneesGabarit
  label: string
  description: string
}

export function suggererVisuels(
  slideIndex: number,
  texteSlide: string,
  aUneImage: boolean,
  style: StyleRapport
): Promise<{ suggestions: SuggestionVisuelle[] }> {
  return poster({ action: "suggererVisuels", slideIndex, texteSlide, aUneImage, style })
}

export function listerTemplatesDrive(): Promise<{ templates: { id: string; nom: string }[] }> {
  return poster({ action: "listerTemplatesDrive" })
}

export interface SuggestionStyleGlobal extends StyleRapport {
  label: string
  description: string
  gabarits?: GabaritDiapositive[]
}

export function suggererStylesGlobaux(
  segments: string[],
  styleActuel: StyleRapport
): Promise<{ suggestions: SuggestionStyleGlobal[] }> {
  return poster({ action: "suggererStylesGlobaux", segments, styleActuel })
}
