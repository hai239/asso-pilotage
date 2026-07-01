// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/subventions-sheet/update
//
//  Body  : { id: string, statut?: string, responsable?: string, atelier?: string, bilan?: boolean }
//  Effet : met à jour les colonnes "Statut workflow", "Responsable", "Atelier"
//          et/ou "Bilan" pour la ligne identifiée par "ID" dans le Sheet
//          (via Apps Script Web App). Au moins un de ces champs doit être fourni.
// ─────────────────────────────────────────────────────────────────────────────

import { getServerUser } from "@/lib/supabase/server"
import { badRequest, callSheetsWebApp, mutationResponse, unauthorized } from "@/lib/sheets-webapp"

interface UpdateRequest { id: string; statut?: string; responsable?: string; atelier?: string; bilan?: boolean }

export async function POST(req: Request) {
  if (!(await getServerUser())) return unauthorized()

  let body: UpdateRequest
  try {
    body = (await req.json()) as UpdateRequest
  } catch {
    return badRequest("Body JSON invalide")
  }

  if (!body.id) {
    return badRequest("Champ requis : id")
  }
  if (body.statut === undefined && body.responsable === undefined && body.atelier === undefined && body.bilan === undefined) {
    return badRequest("Fournis au moins un champ à mettre à jour : statut, responsable, atelier ou bilan")
  }

  const payload: { id: string; statut?: string; responsable?: string; atelier?: string; bilan?: boolean } = { id: body.id }
  if (body.statut !== undefined) payload.statut = body.statut
  if (body.responsable !== undefined) payload.responsable = body.responsable
  if (body.atelier !== undefined) payload.atelier = body.atelier
  if (body.bilan !== undefined) payload.bilan = body.bilan

  const result = await callSheetsWebApp("update", payload)
  return mutationResponse(result)
}
