// Couche client de la génération IA du contenu complet d'un rapport (module Rapports). Voir
// app/api/rapports-generation/route.ts. Lève une erreur en cas d'échec — le dashboard
// (app/rapports/page.tsx) l'attrape et se replie sur `genererContenuBrouillon` (déterministe,
// sans IA).

import type { RapportKPIs } from "@/lib/rapports-data"

export async function genererRapportIA(kpis: RapportKPIs, du: string, au: string): Promise<string[]> {
  const res = await fetch("/api/rapports-generation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kpis, du, au }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Échec de la génération IA")
  return data.segments
}
