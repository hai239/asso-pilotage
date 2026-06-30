// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/subventions-sheet/update
//
//  Body  : { id: string, statut?: string, responsable?: string }
//  Effet : met à jour la colonne "Statut workflow" et/ou "Responsable" pour la
//          ligne identifiée par "ID" dans le Sheet (via Apps Script Web App).
//          Au moins un des deux champs (statut, responsable) doit être fourni.
// ─────────────────────────────────────────────────────────────────────────────

import { badRequest, callSheetsWebApp, mutationResponse } from "@/lib/sheets-webapp"

interface UpdateRequest { id: string; statut?: string; responsable?: string }

export async function POST(req: Request) {
  let body: UpdateRequest
  try {
    body = (await req.json()) as UpdateRequest
  } catch {
    return badRequest("Body JSON invalide")
  }

  if (!body.id) {
    return badRequest("Champ requis : id")
  }
  if (body.statut === undefined && body.responsable === undefined) {
    return badRequest("Fournis au moins un champ à mettre à jour : statut ou responsable")
  }

  const payload: { id: string; statut?: string; responsable?: string } = { id: body.id }
  if (body.statut !== undefined) payload.statut = body.statut
  if (body.responsable !== undefined) payload.responsable = body.responsable

  const result = await callSheetsWebApp("update", payload)
  return mutationResponse(result)
}
