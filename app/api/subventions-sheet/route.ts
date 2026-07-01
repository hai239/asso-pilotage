// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/subventions-sheet
//
//  Fetch le CSV public du Sheet de veille, parse en JSON typé, renvoie au
//  client. Gère les cas d'erreur classiques (Sheet privé, Content-Type
//  inattendu, échec réseau) avec des messages actionnables.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server"
import { getServerUser } from "@/lib/supabase/server"
import {
  CSV_URL,
  OPEN_URL,
  parseCsv,
  resolveColumns,
  type SheetErrorResponse,
  type SheetResponse,
} from "@/lib/veille-subventions"

export const dynamic = "force-dynamic"
export const revalidate = 0

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  if (!(await getServerUser())) {
    return NextResponse.json<SheetErrorResponse>({ status: 401, error: "Non authentifié." }, { status: 401 })
  }
  try {
    const res = await fetch(CSV_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AgoriadeVeilleBot/1.0; +asso-pilotage)",
        "Accept": "text/csv,text/plain,*/*",
      },
      redirect: "follow",
      cache: "no-store",
    })

    if (!res.ok) {
      const body: SheetErrorResponse =
        res.status === 401 || res.status === 403
          ? {
              status: res.status,
              error: "Sheet inaccessible (privé)",
              hint: "Partage le Google Sheet en « Tous les utilisateurs ayant le lien → Lecteur » dans le menu Partager.",
            }
          : { status: res.status, error: `Échec du fetch CSV (HTTP ${res.status})` }
      return NextResponse.json(body, { status: res.status })
    }

    const contentType = res.headers.get("content-type") ?? ""
    if (!contentType.includes("text/csv") && !contentType.includes("text/plain")) {
      return NextResponse.json<SheetErrorResponse>(
        {
          status: 502,
          error: "Réponse inattendue de Google Sheets",
          hint: `Content-Type reçu : ${contentType}. Le Sheet est peut-être encore protégé.`,
        },
        { status: 502 },
      )
    }

    // Force le décodage UTF-8 (le CSV Google est en UTF-8 mais fetch peut mal détecter le charset)
    const buf = await res.arrayBuffer()
    const csv = new TextDecoder("utf-8").decode(buf)
    const { headers, rows } = parseCsv(csv)

    // Ne garder que les vraies subventions (celles qui ont un ID). Sans ce filtre,
    // les lignes vides du Sheet contenant une case à cocher « Bilan » (FALSE)
    // ne sont plus « entièrement vides » et seraient comptées comme des lignes.
    const cols = resolveColumns(headers)
    const dataRows = cols.id ? rows.filter((r) => (r[cols.id!] ?? "").trim() !== "") : rows

    const payload: SheetResponse = {
      headers,
      rows: dataRows,
      fetchedAt: new Date().toISOString(),
      sourceUrl: OPEN_URL,
    }
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    return NextResponse.json<SheetErrorResponse>(
      {
        status: 500,
        error: "Erreur serveur lors du fetch CSV",
        hint: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }
}
