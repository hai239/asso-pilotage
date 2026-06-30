// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/subventions-sheet/responsables
//
//  Lit la feuille « Responsables possibles » du même classeur (colonnes
//  Prénom + Nom) via l'endpoint gviz (lecture par nom d'onglet, pas de gid).
//  Renvoie la liste « Prénom Nom » triée, qui alimente le dropdown Responsable
//  côté tableau ET la validation de données côté Sheet.
//
//  Dégrade proprement : si l'onglet n'existe pas encore ou est inaccessible,
//  renvoie une liste vide + une note (au lieu d'une erreur bloquante), pour que
//  le tableau reste utilisable.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server"
import {
  RESPONSABLES_CSV_URL,
  RESPONSABLES_SHEET_NAME,
  extractResponsables,
  parseCsv,
  type ResponsablesResponse,
} from "@/lib/veille-subventions"

export const dynamic = "force-dynamic"
export const revalidate = 0

function emptyWithNote(note: string): NextResponse {
  return NextResponse.json<ResponsablesResponse>(
    { responsables: [], fetchedAt: new Date().toISOString(), note },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function GET() {
  try {
    const res = await fetch(RESPONSABLES_CSV_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AgoriadeVeilleBot/1.0; +asso-pilotage)",
        "Accept": "text/csv,text/plain,*/*",
      },
      redirect: "follow",
      cache: "no-store",
    })

    if (!res.ok) {
      return emptyWithNote(
        `Feuille « ${RESPONSABLES_SHEET_NAME} » introuvable ou inaccessible (HTTP ${res.status}). ` +
          "Crée l'onglet et vérifie que le classeur est partagé en lecture.",
      )
    }

    const buf = await res.arrayBuffer()
    const csv = new TextDecoder("utf-8").decode(buf)

    // gviz renvoie une page HTML (pas du CSV) si l'onglet n'existe pas.
    if (csv.trimStart().startsWith("<")) {
      return emptyWithNote(
        `Feuille « ${RESPONSABLES_SHEET_NAME} » introuvable. Vérifie le nom exact de l'onglet.`,
      )
    }

    const { headers, rows } = parseCsv(csv)
    const responsables = extractResponsables(headers, rows)

    return NextResponse.json<ResponsablesResponse>(
      { responsables, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    return emptyWithNote(
      "Erreur lors du chargement des responsables : " +
        (err instanceof Error ? err.message : String(err)),
    )
  }
}
