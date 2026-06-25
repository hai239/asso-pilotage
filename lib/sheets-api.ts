// ──────────────────────────────────────────────
// lib/sheets-api.ts
// Couche d'accès Google Sheets via Apps Script Web App
// ──────────────────────────────────────────────

import type { Famille, BeneficiaireParent, BeneficiaireEnfant, Groupe, Inscription, QVP, AutorisationParentale } from "./familles-data"
import { famillesMock, parentsMock, enfantsMock } from "./familles-data"

// ── URL du Web App Apps Script ─────────────────
const API_URL = process.env.NEXT_PUBLIC_SHEETS_API_URL ?? ""

// ── Noms exacts des colonnes Google Sheet ──────
const F = {
  ID:               "ID Famille",
  NOM:              "Nom",
  ADRESSE:          "Adresse",
  CODE_POSTAL:      "Code postal",
  VILLE:            "Ville",
  QVP:              "Quartier QVP",
  TEL:              "Téléphone",
  COMMENTAIRES:     "Commentaires",
  CONTACT_PRINCIPAL:"Contact principal - ID",
  MEMBRES:          "Membres - IDs",
} as const

const C = {
  ID:               "ID contact",
  FAMILLE_NOM:      "Famille",
  ID_FAMILLE:       "ID Famille",
  NOM:              "Nom",
  PRENOM:           "Prénom",
  PARENT:           "Parent",
  BENEFICIAIRE:     "Bénéficiaire",
  TEL:              "N° de téléphone",
  WHATSAPP:         "WhatsApp",
  EMAIL:            "Email",
  ADRESSE:          "Adresse",
  CODE_POSTAL:      "Code postal",
  VILLE:            "Ville",
  DATE_NAISSANCE:   "Date de naissance",
  GROUPE:           "Groupe",
  INSCRIPTIONS:     "Inscriptions",
  ASSIDUITE:        "Assiduité",
  TEST1:            "Test 1",
  TEST2:            "Test 2",
  AUTORISATION:     "Autorisation parentale",
  DROIT_IMAGE:      "Droit à l'image",
} as const

// ── Types bruts renvoyés par le Sheet ──────────
type SheetRow = Record<string, string | number | null>

// ── Helpers ────────────────────────────────────
function str(v: unknown): string  { return v !== null && v !== undefined ? String(v) : "" }
function num(v: unknown): number | null { const n = Number(v); return (v === null || v === "" || isNaN(n)) ? null : n }
function bool(v: unknown): boolean { const s = str(v).toLowerCase(); return s === "oui" || s === "true" || s === "1" }

// Convertit ISO date (ex: "1980-04-13T22:00:00.000Z") → "DD/MM/YYYY"
// Gère aussi les dates déjà au format DD/MM/YYYY
// Utilise l'heure locale (pas UTC) car Sheets stocke les dates en heure locale
function parseDate(v: unknown): string {
  const s = str(v)
  if (!s) return ""
  if (s.includes("/")) return s  // déjà au bon format
  if (s.includes("T") || s.includes("-")) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      const day   = String(d.getDate()).padStart(2, "0")
      const month = String(d.getMonth() + 1).padStart(2, "0")
      const year  = d.getFullYear()
      return `${day}/${month}/${year}`
    }
  }
  return s
}

function calculerAge(dateStr: string): number | null {
  const parts = dateStr.split("/")
  if (parts.length !== 3) return null
  const [day, month, year] = parts.map(Number)
  if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900) return null
  const today = new Date()
  const naissance = new Date(year, month - 1, day)
  let age = today.getFullYear() - naissance.getFullYear()
  const m = today.getMonth() - naissance.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < naissance.getDate())) age--
  return age >= 0 ? age : null
}

// ── Adaptateurs Sheet → Types app ─────────────
function rowToFamille(row: SheetRow): Famille {
  return {
    id:               str(row[F.ID]),
    nomFamille:       str(row[F.NOM]),
    contactPrincipal: str(row[F.CONTACT_PRINCIPAL]),
    telephone:        str(row[F.TEL]),
    adresse:          str(row[F.ADRESSE]),
    codePostal:       str(row[F.CODE_POSTAL]),
    ville:            str(row[F.VILLE]),
    quartierQVP:      (str(row[F.QVP]).toLowerCase() === "oui" ? "OUI" : "NON") as QVP,
    commentaires:     str(row[F.COMMENTAIRES]),
  }
}

function rowToParent(row: SheetRow): BeneficiaireParent {
  const dateNaissance = parseDate(row[C.DATE_NAISSANCE])
  return {
    id:           str(row[C.ID]),
    idFamille:    str(row[C.ID_FAMILLE]),
    nom:          str(row[C.NOM]),
    prenom:       str(row[C.PRENOM]),
    telephone:    str(row[C.TEL]),
    adresse:      str(row[C.ADRESSE]),
    codePostal:   str(row[C.CODE_POSTAL]),
    ville:        str(row[C.VILLE]),
    email:        str(row[C.EMAIL]),
    whatsapp:     str(row[C.WHATSAPP]),
    groupe:       str(row[C.GROUPE]) as Groupe,
    test1:        num(row[C.TEST1]),
    test2:        num(row[C.TEST2]),
    inscriptions: str(row[C.INSCRIPTIONS]) as Inscription,
    assiduite:    num(row[C.ASSIDUITE]) ?? 0,
    dateNaissance,
    age:          dateNaissance ? calculerAge(dateNaissance) : null,
  }
}

function rowToEnfant(row: SheetRow): BeneficiaireEnfant {
  const dateNaissance = parseDate(row[C.DATE_NAISSANCE])
  return {
    id:                    str(row[C.ID]),
    idFamille:             str(row[C.ID_FAMILLE]),
    nom:                   str(row[C.NOM]),
    prenom:                str(row[C.PRENOM]),
    telephone:             str(row[C.TEL]),
    adresse:               str(row[C.ADRESSE]),
    codePostal:            str(row[C.CODE_POSTAL]),
    ville:                 str(row[C.VILLE]),
    email:                 str(row[C.EMAIL]),
    whatsapp:              str(row[C.WHATSAPP]),
    groupe:                str(row[C.GROUPE]) as Groupe,
    test1:                 num(row[C.TEST1]),
    test2:                 num(row[C.TEST2]),
    autorisationParentale: str(row[C.AUTORISATION]) as AutorisationParentale,
    inscriptions:          str(row[C.INSCRIPTIONS]) as Inscription,
    assiduite:             num(row[C.ASSIDUITE]) ?? 0,
    dateNaissance,
    age:                   dateNaissance ? calculerAge(dateNaissance) : null,
  }
}

// ── Adaptateurs Types app → Sheet ─────────────
function familleToRow(f: Famille): SheetRow {
  return {
    [F.ID]:               f.id,
    [F.NOM]:              f.nomFamille,
    [F.ADRESSE]:          f.adresse,
    [F.CODE_POSTAL]:      f.codePostal,
    [F.VILLE]:            f.ville,
    [F.QVP]:              f.quartierQVP === "OUI" ? "Oui" : "Non",
    [F.TEL]:              f.telephone,
    [F.COMMENTAIRES]:     f.commentaires,
    [F.CONTACT_PRINCIPAL]:f.contactPrincipal,
  }
}

function parentToRow(p: BeneficiaireParent): SheetRow {
  return {
    [C.ID]:           p.id,
    [C.ID_FAMILLE]:   p.idFamille,
    [C.NOM]:          p.nom,
    [C.PRENOM]:       p.prenom,
    [C.PARENT]:       "Oui",
    [C.BENEFICIAIRE]: "Non",
    [C.TEL]:          p.telephone,
    [C.WHATSAPP]:     p.whatsapp,
    [C.EMAIL]:        p.email,
    [C.ADRESSE]:      p.adresse,
    [C.CODE_POSTAL]:  p.codePostal,
    [C.VILLE]:        p.ville,
    [C.DATE_NAISSANCE]:p.dateNaissance ?? "",
    [C.GROUPE]:       p.groupe,
    [C.INSCRIPTIONS]: p.inscriptions,
    [C.ASSIDUITE]:    p.assiduite,
    [C.TEST1]:        p.test1 ?? "",
    [C.TEST2]:        p.test2 ?? "",
    [C.AUTORISATION]: "",
  }
}

function enfantToRow(e: BeneficiaireEnfant): SheetRow {
  return {
    [C.ID]:           e.id,
    [C.ID_FAMILLE]:   e.idFamille,
    [C.NOM]:          e.nom,
    [C.PRENOM]:       e.prenom,
    [C.PARENT]:       "Non",
    [C.BENEFICIAIRE]: "Oui",
    [C.TEL]:          e.telephone,
    [C.WHATSAPP]:     e.whatsapp,
    [C.EMAIL]:        e.email,
    [C.ADRESSE]:      e.adresse,
    [C.CODE_POSTAL]:  e.codePostal,
    [C.VILLE]:        e.ville,
    [C.DATE_NAISSANCE]:e.dateNaissance ?? "",
    [C.GROUPE]:       e.groupe,
    [C.INSCRIPTIONS]: e.inscriptions,
    [C.ASSIDUITE]:    e.assiduite,
    [C.TEST1]:        e.test1 ?? "",
    [C.TEST2]:        e.test2 ?? "",
    [C.AUTORISATION]: e.autorisationParentale,
  }
}

// ── Appels API ─────────────────────────────────
async function apiGet(action: string) {
  const res = await fetch(`${API_URL}?action=${action}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function apiPost(body: unknown) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── LECTURE ─────────────────────────────────────
export async function fetchAllData(): Promise<{
  familles: Famille[]
  parents:  BeneficiaireParent[]
  enfants:  BeneficiaireEnfant[]
}> {
  if (!API_URL) {
    // Fallback sur les données mock si l'URL n'est pas configurée
    return { familles: famillesMock, parents: parentsMock, enfants: enfantsMock }
  }

  const data = await apiGet("all") as {
    familles: SheetRow[]
    contacts: SheetRow[]
  }

  const familles = data.familles.map(rowToFamille)
  const parents  = data.contacts.filter(r => bool(r[C.PARENT])).map(rowToParent)
  const enfants  = data.contacts.filter(r => bool(r[C.BENEFICIAIRE])).map(rowToEnfant)

  return { familles, parents, enfants }
}

// ── CRUD Famille ────────────────────────────────
export async function saveFamille(f: Famille, isNew: boolean) {
  if (!API_URL) return
  if (isNew) {
    return apiPost({ action: "create", sheet: "Famille", data: familleToRow(f) })
  }
  return apiPost({ action: "update", sheet: "Famille", idField: F.ID, id: f.id, data: familleToRow(f) })
}

export async function removeFamille(id: string) {
  if (!API_URL) return
  return apiPost({ action: "delete", sheet: "Famille", idField: F.ID, id })
}

// ── CRUD Contact (parent ou enfant) ────────────
export async function saveParent(p: BeneficiaireParent, isNew: boolean) {
  if (!API_URL) return
  if (isNew) {
    return apiPost({ action: "create", sheet: "Contact", data: parentToRow(p) })
  }
  return apiPost({ action: "update", sheet: "Contact", idField: C.ID, id: p.id, data: parentToRow(p) })
}

export async function saveEnfant(e: BeneficiaireEnfant, isNew: boolean) {
  if (!API_URL) return
  if (isNew) {
    return apiPost({ action: "create", sheet: "Contact", data: enfantToRow(e) })
  }
  return apiPost({ action: "update", sheet: "Contact", idField: C.ID, id: e.id, data: enfantToRow(e) })
}

export async function removeContact(id: string) {
  if (!API_URL) return
  return apiPost({ action: "delete", sheet: "Contact", idField: C.ID, id })
}
