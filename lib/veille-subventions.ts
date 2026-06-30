// ─────────────────────────────────────────────────────────────────────────────
//  Veille subventions — types, constantes et helpers partagés
//
//  Consommé par :
//    • app/veille-subventions/page.tsx           (rendu client)
//    • app/veille-subventions/_components/*      (cellules du tableau)
//    • app/api/subventions-sheet/route.ts        (lecture du Sheet)
//
//  Tout est pur (pas d'I/O, pas de DOM) → importable indifféremment côté client
//  ou serveur Next.js.
// ─────────────────────────────────────────────────────────────────────────────

// ── Identifiants Google Sheets ────────────────────────────────────────────────

export const SHEET_ID = "1TJilqnRkQpPF6LmSXiyjxMgNgEB_sTE7e_HEnkB2uL0"
export const SHEET_GID = "351343980"

export const CSV_URL   = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
export const OPEN_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${SHEET_GID}`
export const EMBED_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/preview?gid=${SHEET_GID}&rm=minimal&widget=true&headers=false`

/**
 * Feuille listant les responsables possibles (colonnes « Prénom » + « Nom »).
 * Lue par son NOM via l'endpoint gviz → pas besoin de connaître son gid, et
 * robuste si l'onglet est déplacé. La feuille doit être publique (comme la
 * feuille subventions).
 */
export const RESPONSABLES_SHEET_NAME = "Responsables possibles"
export const RESPONSABLES_CSV_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(RESPONSABLES_SHEET_NAME)}`

// ── Statuts workflow ──────────────────────────────────────────────────────────

/** Les 7 valeurs canoniques du dropdown « Statut workflow » (Sheet ↔ interface). */
export const STATUT_VALUES = [
  "Nouveau",
  "En préparation",
  "Déposé",
  "Accepté en attente de paiement",
  "Accepté et payé",
  "Refusé",
  "Hors délai",
] as const

export type StatutValue = (typeof STATUT_VALUES)[number]

/**
 * Statuts pour lesquels les alertes de date limite restent pertinentes.
 * Au-delà → la subvention est gérée ou close, l'urgence n'a plus de sens.
 */
export const STATUTS_AVEC_URGENCE: readonly string[] = ["Nouveau", "En préparation"]

/** True si la valeur fait partie des 6 valeurs canoniques (utilise pour filtrer les valeurs obsolètes). */
export function isStatutCanonique(s: string | undefined): boolean {
  return !!s && (STATUT_VALUES as readonly string[]).includes(s)
}

// ── Types partagés API ↔ UI ───────────────────────────────────────────────────

export interface SheetRow { [columnName: string]: string }

export interface SheetResponse {
  headers: string[]
  rows: SheetRow[]
  fetchedAt: string
  sourceUrl: string
}

export interface SheetErrorResponse {
  error: string
  hint?: string
  status: number
}

export interface ResponsablesResponse {
  responsables: string[]
  fetchedAt: string
  /** Renseigné quand la liste est vide pour une raison non bloquante (onglet absent, etc.). */
  note?: string
}

/** Mapping des colonnes du Sheet sur des clés stables (résultat de `resolveColumns`). */
export interface ResolvedColumns {
  id: string | null
  intitule: string | null
  organisme: string | null
  type: string | null
  montantMin: string | null
  montantMax: string | null
  dateLimite: string | null
  datePub: string | null
  statut: string | null
  url: string | null
  sourceNom: string | null
  responsable: string | null
  secteurs: string | null
}

// ── Détection automatique des colonnes du Sheet ───────────────────────────────

/**
 * Trouve dans `headers` la première colonne dont le nom matche un des candidats
 * (insensible à la casse, aux accents, aux espaces et à la ponctuation).
 */
export function findCol(headers: string[], candidates: string[]): string | null {
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "")
  const normalized = headers.map((h) => ({ raw: h, n: norm(h) }))
  for (const c of candidates) {
    const cn = norm(c)
    const found = normalized.find((h) => h.n === cn || h.n.includes(cn))
    if (found) return found.raw
  }
  return null
}

/** Résout en une passe les noms réels des colonnes utiles dans le Sheet. */
export function resolveColumns(headers: string[]): ResolvedColumns {
  return {
    id:          findCol(headers, ["id"]),
    intitule:    findCol(headers, ["intitule", "intitulé", "titre", "nom"]),
    organisme:   findCol(headers, ["organisme", "financeur"]),
    type:        findCol(headers, ["type"]),
    montantMin:  findCol(headers, ["montant_min", "montant min"]),
    montantMax:  findCol(headers, ["montant_max", "montant max", "montant"]),
    dateLimite:  findCol(headers, ["date_limite_depot", "date_limite", "date limite", "echeance", "deadline"]),
    datePub:     findCol(headers, ["date_publication", "date_detection", "date"]),
    statut:      findCol(headers, ["statut_workflow", "statut"]),
    url:         findCol(headers, ["url_source", "url_detail", "url", "lien"]),
    sourceNom:   findCol(headers, ["source_nom", "source"]),
    responsable: findCol(headers, ["responsable", "assigne"]),
    secteurs:    findCol(headers, ["secteurs_eligibles", "secteurs"]),
  }
}

// ── Parsing CSV (RFC 4180 — champs entre guillemets et "" échappés) ────────────

/**
 * Parse un texte CSV en { headers, rows }. Pur (pas d'I/O).
 * Partagé par les routes de lecture (feuille subventions + responsables).
 */
export function parseCsv(text: string): { headers: string[]; rows: SheetRow[] } {
  const out: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ",") { row.push(field); field = ""; i++; continue }
    if (c === "\r") { i++; continue }
    if (c === "\n") { row.push(field); out.push(row); row = []; field = ""; i++; continue }
    field += c; i++
  }
  if (field.length > 0 || row.length > 0) { row.push(field); out.push(row) }
  while (out.length > 0 && out[out.length - 1].every((c) => c === "")) out.pop()

  if (out.length === 0) return { headers: [], rows: [] }
  const headers = out[0].map((h) => h.trim())
  const rows: SheetRow[] = out.slice(1).map((line) => {
    const obj: SheetRow = {}
    headers.forEach((h, idx) => { obj[h] = (line[idx] ?? "").trim() })
    return obj
  })
  return { headers, rows }
}

// ── Responsables (feuille « Responsables possibles ») ──────────────────────────

/**
 * Construit la liste triée et dédoublonnée des responsables à partir des lignes
 * de la feuille « Responsables possibles ». On ne retient que le **prénom**
 * (colonne « Prénom » ; à défaut, la première colonne).
 */
export function extractResponsables(headers: string[], rows: SheetRow[]): string[] {
  const prenomCol = findCol(headers, ["prenom", "prénom", "firstname", "first name"]) ?? headers[0]
  const set = new Set<string>()
  for (const r of rows) {
    const prenom = (prenomCol ? r[prenomCol] : "").trim()
    if (prenom) set.add(prenom)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"))
}

// ── Formattage et parsing ─────────────────────────────────────────────────────

/** "20 000 €" / "20000" → "20 000 €". Vide ou 0 → "—". */
export function formatMontant(s: string | undefined): string {
  if (!s) return "—"
  const n = Number(s.replace(/[^\d.-]/g, ""))
  if (!Number.isFinite(n) || n === 0) return "—"
  return `${n.toLocaleString("fr-FR")} €`
}

/** "2026-05-30" → "30/05/2026". Tout autre format passe en l'état. */
export function formatDate(s: string | undefined): string {
  if (!s) return "—"
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return s
}

/**
 * Nombre de jours entre aujourd'hui et la date limite.
 * - Positif → date dans le futur
 * - Négatif → date passée
 * - 0       → aujourd'hui
 * - null    → date absente ou illisible
 *
 * Accepte les formats DD/MM/YYYY (Sheet) et YYYY-MM-DD (ISO).
 */
export function daysUntil(s: string | undefined): number | null {
  if (!s) return null
  let y: number, m: number, d: number
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const fr  = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3] }
  else if (fr) { d = +fr[1]; m = +fr[2]; y = +fr[3] }
  else return null
  const deadline = new Date(y, m - 1, d)
  if (isNaN(deadline.getTime())) return null
  deadline.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((deadline.getTime() - today.getTime()) / 86_400_000)
}

/**
 * Extrait l'acronyme d'un nom d'organisme.
 *   "Office national des forêts (ONF)" → { acronym: "ONF", name: "Office national des forêts" }
 *   "FDVA — Fonds pour le développement…" → { acronym: "FDVA", name: "Fonds pour le développement…" }
 *   "Région Pays de la Loire" → { acronym: null, name: "Région Pays de la Loire" }
 */
export function parseOrganisme(s: string | undefined): { acronym: string | null; name: string } {
  if (!s) return { acronym: null, name: "" }
  const trimmed = s.trim()
  // "Nom complet (ACR)" — ACR en majuscules, 2 à 10 caractères
  const trailing = trimmed.match(/^(.+?)\s*\(([A-Z]{2,10})\)\s*$/)
  if (trailing) return { acronym: trailing[2].trim(), name: trailing[1].trim() }
  // "ACR - Nom" / "ACR — Nom" / "ACR : Nom"
  const leading = trimmed.match(/^([A-Z]{2,10})\s*[-–—:]\s*(.+)$/)
  if (leading) return { acronym: leading[1].trim(), name: leading[2].trim() }
  return { acronym: null, name: trimmed }
}

// ── Couleurs sémantiques ──────────────────────────────────────────────────────

/** Classes Tailwind pour le badge d'un statut donné. Fallback gris italique si valeur inconnue. */
export function statutBadgeClasses(s: string | undefined): string {
  const norm = (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (norm === "nouveau")        return "bg-orange-100 text-orange-700"
  if (norm === "en preparation") return "bg-sky-100 text-sky-700"
  // Graduation de vert : plus la subvention avance dans le workflow, plus le vert est foncé.
  if (norm === "depose")         return "bg-emerald-100 text-emerald-700"
  if (norm === "accepte en attente de paiement") return "bg-emerald-200 text-emerald-800"
  if (norm === "accepte et paye") return "bg-emerald-600 text-white"
  if (norm === "refuse")         return "bg-red-100 text-red-700"
  if (norm === "hors delai")     return "bg-slate-100 text-slate-500"
  return "bg-slate-200 text-slate-500 italic" // valeur obsolète / inconnue
}

/**
 * Badge d'urgence basé sur les jours restants jusqu'à la date limite.
 *
 * - J+1 et plus (passé)      → gris « Dépassée »
 * - J0  (aujourd'hui)         → rouge vif « Aujourd'hui »
 * - J-1 à J-7  (≤ 7 jours)    → rouge vif « J-X »   (alerte critique)
 * - J-8 à J-30 (≤ 30 jours)   → ambre  « J-X »      (alerte modérée)
 * - > 30 jours                → pas de badge        (date normale)
 */
export function deadlineBadge(days: number | null): { label: string; cls: string } | null {
  if (days === null) return null
  if (days < 0)      return { label: "Dépassée",    cls: "bg-slate-100 text-slate-500" }
  if (days === 0)    return { label: "Aujourd'hui", cls: "bg-red-500 text-white font-semibold" }
  if (days <= 7)     return { label: `J-${days}`,   cls: "bg-red-500 text-white font-semibold" }
  if (days <= 30)    return { label: `J-${days}`,   cls: "bg-amber-100 text-amber-800 font-medium" }
  return null
}
