// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/subventions-sheet/delete
//
//  Body  : { id: string }
//  Effet : supprime la ligne identifiée par "ID" dans le Sheet
//          (via Apps Script Web App).
// ─────────────────────────────────────────────────────────────────────────────

import { getServerUser } from "@/lib/supabase/server"
import { badRequest, callSheetsWebApp, mutationResponse, unauthorized } from "@/lib/sheets-webapp"

interface DeleteRequest { id: string }

export async function POST(req: Request) {
  if (!(await getServerUser())) return unauthorized()

  let body: DeleteRequest
  try {
    body = (await req.json()) as DeleteRequest
  } catch {
    return badRequest("Body JSON invalide")
  }

  if (!body.id) {
    return badRequest("Champ requis : id")
  }

  const result = await callSheetsWebApp("delete", { id: body.id })
  return mutationResponse(result)
}
