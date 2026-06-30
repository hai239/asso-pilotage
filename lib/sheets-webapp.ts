// ─────────────────────────────────────────────────────────────────────────────
//  Helper d'appel au Web App Apps Script qui écrit dans le Google Sheet de
//  veille. Le Web App vit dans le projet Apps Script existant (celui qui fait
//  déjà la veille quotidienne). Il expose un `doPost` qui reçoit
//  `{ action, id, statut?, secret }`.
//
//  Configuration (.env.local) :
//    SHEETS_WEBAPP_URL   = https://script.google.com/macros/s/AKfy.../exec
//    SHEETS_WEBAPP_TOKEN = <même secret que celui codé en dur dans le Apps Script>
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server"

export type SheetsAction = "update" | "delete"

export interface SheetsCallResult {
  ok: boolean
  status: number
  error?: string
  hint?: string
}

// ─── Appel au Web App (avec retry sur cold start) ─────────────────────────────

const COLD_START_RETRY_DELAY_MS = 1500
const MAX_ATTEMPTS = 2

export async function callSheetsWebApp(
  action: SheetsAction,
  payload: { id: string; statut?: string; responsable?: string },
): Promise<SheetsCallResult> {
  const url = process.env.SHEETS_WEBAPP_URL
  const token = process.env.SHEETS_WEBAPP_TOKEN

  if (!url || !token) {
    return {
      ok: false,
      status: 501,
      error: "Écriture non configurée",
      hint:
        "Variables d'environnement SHEETS_WEBAPP_URL et SHEETS_WEBAPP_TOKEN manquantes dans .env.local. " +
        "Déploie le Apps Script en Web App et renseigne ces deux variables, puis redémarre le serveur.",
    }
  }

  const body = JSON.stringify({ action, secret: token, ...payload })

  // Apps Script s'endort après ~5 min d'inactivité et renvoie du HTML d'erreur
  // au cold start. On retente une fois avec un petit délai avant d'abandonner.
  let lastNonJsonText: string | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        redirect: "follow",
        cache: "no-store",
      })
      const text = await res.text()

      if (!text.trim().startsWith("{")) {
        lastNonJsonText = text
        if (attempt < MAX_ATTEMPTS) {
          await sleep(COLD_START_RETRY_DELAY_MS)
          continue
        }
        return nonJsonError(text)
      }

      const parsed = JSON.parse(text) as { ok: boolean; error?: string }
      if (!parsed.ok) {
        return { ok: false, status: 502, error: parsed.error ?? "Erreur côté Apps Script" }
      }
      return { ok: true, status: 200 }
    } catch (err) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(COLD_START_RETRY_DELAY_MS)
        continue
      }
      return {
        ok: false,
        status: 500,
        error: "Échec d'appel au Web App",
        hint: err instanceof Error ? err.message : String(err),
      }
    }
  }
  // Inatteignable en pratique, mais TS exige un return explicite.
  return {
    ok: false,
    status: 502,
    error: "Réponse non-JSON après retry",
    hint: lastNonJsonText ? lastNonJsonText.slice(0, 200) : undefined,
  }
}

// ─── Helpers pour les routes API ──────────────────────────────────────────────

/** Convertit un `SheetsCallResult` en `NextResponse` JSON (200 si ok, sinon erreur). */
export function mutationResponse(result: SheetsCallResult): NextResponse {
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: result.status,
        error: result.error ?? "Erreur inconnue",
        hint: result.hint,
      },
      { status: result.status },
    )
  }
  return NextResponse.json({ ok: true })
}

/** Réponse standard 400 « Body JSON invalide ». */
export function badRequest(error: string): NextResponse {
  return NextResponse.json({ ok: false, status: 400, error }, { status: 400 })
}

// ─── Helpers internes ─────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function nonJsonError(rawText: string): SheetsCallResult {
  // Nettoie le HTML pour ne garder qu'un snippet lisible (souvent le titre d'erreur Google)
  const snippet = rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)
  return {
    ok: false,
    status: 502,
    error: "Réponse non-JSON du Web App Apps Script (cold start ou config)",
    hint:
      (snippet ? `Réponse : « ${snippet} ». ` : "") +
      "Si l'erreur persiste : vérifie que le déploiement est en « Web app / Anyone » " +
      "et que l'URL finit en /exec. Sinon, retente dans 5 s — Apps Script s'endort après ~5 min d'inactivité.",
  }
}
