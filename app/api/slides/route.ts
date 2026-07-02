import { NextRequest, NextResponse } from "next/server"
import { getServerUser } from "@/lib/supabase/server"
import {
  moveDriveFile,
  exportDriveFileAsPdf,
  deleteDriveFile,
  RAPPORTS_BROUILLONS_FOLDER_ID,
  RAPPORTS_ARCHIVES_FOLDER_ID,
} from "@/lib/google-sheets-server"
import { reconstruireSlides, lireTextesRapport } from "@/lib/google-slides-server"
import type { FormatRapport } from "@/lib/rapports-data"

function ok(data: unknown) {
  return NextResponse.json(data)
}
function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(request: NextRequest) {
  if (!(await getServerUser())) return err("Non authentifié.", 401)
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action") ?? "ping"

  try {
    switch (action) {
      case "ping":
        return ok({ ok: true })
      case "exportPdf": {
        const presentationId = searchParams.get("presentationId")
        if (!presentationId) return err("presentationId manquant")
        const pdf = await exportDriveFileAsPdf(presentationId)
        return new NextResponse(new Uint8Array(pdf), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "attachment; filename=rapport.pdf",
          },
        })
      }
      default:
        return err(`Action inconnue : ${action}`)
    }
  } catch (e) {
    console.error("[slides/GET]", e)
    return err(String(e), 500)
  }
}

export async function POST(request: NextRequest) {
  if (!(await getServerUser())) return err("Non authentifié.", 401)
  const body = await request.json()
  const { action } = body

  try {
    switch (action) {
      case "creer": {
        if (!RAPPORTS_BROUILLONS_FOLDER_ID) {
          return err("Dossier Drive Rapports/Brouillons non configuré (variable d'environnement manquante)")
        }
        const { segments, titre, format } = body as { segments: string[]; titre: string; format?: FormatRapport }
        return ok(await reconstruireSlides(null, segments, titre, format))
      }
      case "sync": {
        // `nouveauFichier` : le format (16:9/A4) a changé côté brouillon — l'API Slides ne
        // permet pas de redimensionner une présentation existante (cf. lib/google-slides-server.ts),
        // on force donc la création d'un tout nouveau fichier plutôt que de réutiliser
        // `presentationId`. L'ancien fichier reste sur Drive (best-effort, non supprimé).
        const { presentationId, segments, format, nouveauFichier, titre } = body as {
          presentationId: string
          segments: string[]
          format?: FormatRapport
          nouveauFichier?: boolean
          titre?: string
        }
        return ok(await reconstruireSlides(nouveauFichier ? null : presentationId, segments, titre, format))
      }
      case "lire": {
        const { presentationId } = body as { presentationId: string }
        return ok({ segments: await lireTextesRapport(presentationId) })
      }
      case "valider": {
        const { presentationId } = body as { presentationId: string }
        if (!RAPPORTS_BROUILLONS_FOLDER_ID || !RAPPORTS_ARCHIVES_FOLDER_ID) {
          return err("Dossiers Drive Rapports non configurés (variables d'environnement manquantes)")
        }
        await moveDriveFile(presentationId, RAPPORTS_BROUILLONS_FOLDER_ID, RAPPORTS_ARCHIVES_FOLDER_ID)
        return ok({ ok: true })
      }
      case "supprimer": {
        const { presentationId } = body as { presentationId: string }
        await deleteDriveFile(presentationId)
        return ok({ ok: true })
      }
      default:
        return err(`Action inconnue : ${action}`)
    }
  } catch (e) {
    console.error("[slides/POST]", e)
    return err(String(e), 500)
  }
}
