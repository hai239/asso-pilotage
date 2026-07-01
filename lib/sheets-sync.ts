// ──────────────────────────────────────────────
// Google Sheets — stub de synchronisation (chantier 2.1, Lot 6)
// ──────────────────────────────────────────────
// Ce fichier contient les signatures et la sérialisation des entités à
// destination du Google Sheet. L'appel HTTP réel (Google Apps Script Web App
// ou autre) sera branché par le collègue qui s'occupe du Sheet — voir
// docs/explanation/adr/004-google-sheets-integration.md, Option A.
//
// Conventions de mapping (pour rappel) :
//   • Listes (taches, besoins, etapes, beneficiaireIds…) : sérialisées JSON
//     pour tenir dans une cellule. Le Sheet stocke des strings, l'app les
//     reparse à la lecture.
//   • Booléens : "VRAI" / "FAUX" pour rester lisible côté Sheet.
//   • Notes nulles (test non passé) : cellule vide.

import type { NotesPositionnement, Thematique } from "./positionnement"
import type { FicheAtelier } from "./atelier"
import { THEMATIQUES } from "./positionnement"

// ──────────────────────────────────────────────
// Types — alignés avec les pages app/
// ──────────────────────────────────────────────

interface BeneficiairePayload {
  id: number
  prenom: string
  nom: string
  dateNaissance: string
  email: string
  telephone: string
  nomParent: string
  telephoneParent: string
  emailParent: string
  dateInscription: string
  niveau: string
  statut: string
  notes: string
  positionnementInitial: NotesPositionnement
  positionnementFinal:   NotesPositionnement
}

interface AtelierPayload extends FicheAtelier {
  id: number
  titre: string
  description: string
  date: string
  heure: string
  duree: string
  salle: string
  formatrice: string
  statut: string
  beneficiaireIds: number[]
  benevoleIds: number[]
}

interface GroupePayload {
  id: number
  nom: string
  atelierId: number | null
  type: "niveau" | "âge" | "mixte"
  description: string
  beneficiaireIds: number[]
  etat: "brouillon" | "valide"
  dateValidation: string | null
}

// ──────────────────────────────────────────────
// Sérialisation Bénéficiaire → ligne de Sheet
// ──────────────────────────────────────────────

export function beneficiaireToRow(b: BeneficiairePayload): Record<string, string | number> {
  const row: Record<string, string | number> = {
    id: b.id,
    prenom: b.prenom,
    nom: b.nom,
    dateNaissance: b.dateNaissance,
    email: b.email,
    telephone: b.telephone,
    nomParent: b.nomParent,
    telephoneParent: b.telephoneParent,
    emailParent: b.emailParent,
    dateInscription: b.dateInscription,
    niveau: b.niveau,
    statut: b.statut,
    notes: b.notes,
  }
  for (const t of THEMATIQUES) {
    row[`init_${t.key}`]  = b.positionnementInitial[t.key] ?? ""
    row[`final_${t.key}`] = b.positionnementFinal[t.key]   ?? ""
  }
  return row
}

export function rowToBeneficiaire(row: Record<string, string>): BeneficiairePayload {
  const initial = {} as NotesPositionnement
  const final   = {} as NotesPositionnement
  for (const t of THEMATIQUES) {
    initial[t.key] = row[`init_${t.key}`]  ? Number(row[`init_${t.key}`])  : null
    final[t.key]   = row[`final_${t.key}`] ? Number(row[`final_${t.key}`]) : null
  }
  return {
    id: Number(row.id),
    prenom: row.prenom, nom: row.nom, dateNaissance: row.dateNaissance,
    email: row.email, telephone: row.telephone,
    nomParent: row.nomParent, telephoneParent: row.telephoneParent, emailParent: row.emailParent,
    dateInscription: row.dateInscription,
    niveau: row.niveau, statut: row.statut, notes: row.notes,
    positionnementInitial: initial, positionnementFinal: final,
  }
}

// ──────────────────────────────────────────────
// Sérialisation Atelier → ligne de Sheet
// ──────────────────────────────────────────────

export function atelierToRow(a: AtelierPayload): Record<string, string | number> {
  const row: Record<string, string | number> = {
    id: a.id,
    titre: a.titre, description: a.description,
    date: a.date, heure: a.heure, duree: a.duree,
    salle: a.salle, formatrice: a.formatrice, statut: a.statut,
    periode: a.periode,
    audience: a.audience,
    couleur: a.couleur,
    ageMin: a.ageMin ?? "",
    ageMax: a.ageMax ?? "",
    tailleGroupeCible: a.tailleGroupeCible ?? "",
    ratioEncadrement:  a.ratioEncadrement  ?? "",
    mixerNiveaux: a.mixerNiveaux ? "VRAI" : "FAUX",
    taches:                 JSON.stringify(a.taches),
    besoins:                JSON.stringify(a.besoins),
    etapes:                 JSON.stringify(a.etapes),
    personnesImpliqueesIds: JSON.stringify(a.personnesImpliqueesIds),
    beneficiaireIds:        JSON.stringify(a.beneficiaireIds),
    benevoleIds:            JSON.stringify(a.benevoleIds),
  }
  for (const t of THEMATIQUES) {
    row[`comp_${t.key}`] = a.competencesCiblees.includes(t.key) ? "VRAI" : "FAUX"
  }
  return row
}

export function rowToAtelier(row: Record<string, string>): AtelierPayload {
  const competences: Thematique[] = []
  for (const t of THEMATIQUES) {
    if (row[`comp_${t.key}`] === "VRAI") competences.push(t.key)
  }
  const parseList = <T>(s: string | undefined, fallback: T): T => {
    if (!s) return fallback
    try { return JSON.parse(s) as T } catch { return fallback }
  }
  return {
    id: Number(row.id),
    titre: row.titre, description: row.description,
    date: row.date, heure: row.heure, duree: row.duree,
    salle: row.salle, formatrice: row.formatrice, statut: row.statut,
    periode: row.periode ?? "",
    audience: (row.audience === "parents" ? "parents" : "eleves"),
    couleur: (["teal","emerald","amber","orange","violet","slate"].includes(row.couleur) ? row.couleur : "teal") as FicheAtelier["couleur"],
    ageMin: row.ageMin ? Number(row.ageMin) : null,
    ageMax: row.ageMax ? Number(row.ageMax) : null,
    tailleGroupeCible: row.tailleGroupeCible ? Number(row.tailleGroupeCible) : null,
    ratioEncadrement:  row.ratioEncadrement  ? Number(row.ratioEncadrement)  : null,
    mixerNiveaux: row.mixerNiveaux === "VRAI",
    modeGroupage: row.modeGroupage === "disponibilite" ? "disponibilite" : "notes",
    taches:                 parseList<string[]>(row.taches, []),
    besoins:                parseList<string[]>(row.besoins, []),
    etapes:                 parseList<string[]>(row.etapes, []),
    personnesImpliqueesIds: parseList<number[]>(row.personnesImpliqueesIds, []),
    beneficiaireIds:        parseList<number[]>(row.beneficiaireIds, []),
    benevoleIds:            parseList<number[]>(row.benevoleIds, []),
    competencesCiblees: competences,
  }
}

// ──────────────────────────────────────────────
// Sérialisation Groupe → ligne de Sheet
// ──────────────────────────────────────────────

export function groupeToRow(g: GroupePayload): Record<string, string | number> {
  return {
    id: g.id,
    nom: g.nom,
    atelierId: g.atelierId ?? "",
    type: g.type,
    description: g.description,
    beneficiaireIds: JSON.stringify(g.beneficiaireIds),
    etat: g.etat,
    dateValidation: g.dateValidation ?? "",
  }
}

export function rowToGroupe(row: Record<string, string>): GroupePayload {
  const parseList = <T>(s: string | undefined, fallback: T): T => {
    if (!s) return fallback
    try { return JSON.parse(s) as T } catch { return fallback }
  }
  return {
    id: Number(row.id),
    nom: row.nom,
    atelierId: row.atelierId ? Number(row.atelierId) : null,
    type: (row.type as "niveau" | "âge" | "mixte") ?? "mixte",
    description: row.description,
    beneficiaireIds: parseList<number[]>(row.beneficiaireIds, []),
    etat: (row.etat as "brouillon" | "valide") ?? "brouillon",
    dateValidation: row.dateValidation || null,
  }
}

// ──────────────────────────────────────────────
// Endpoints HTTP — à compléter par le collègue Sheet
// ──────────────────────────────────────────────
//
// Une fois le Google Apps Script Web App déployé, renseigner l'URL dans
// NEXT_PUBLIC_SHEETS_SCRIPT_URL et implémenter les fonctions ci-dessous
// en se basant sur les serializers fournis plus haut.
//
// Exemple d'utilisation côté app (à brancher quand le sheet sera prêt) :
//
//   const benefs = await fetchBeneficiairesFromSheet()
//   localStorage.setItem(S_BENEF, JSON.stringify(benefs))
//
//   for (const a of nouveauxAteliers) await pushAtelierToSheet(a)
//
// Le mapping des colonnes est documenté dans ADR 004 et conforme aux
// fonctions toRow / rowToX ci-dessus.

const SCRIPT_URL = process.env.NEXT_PUBLIC_SHEETS_SCRIPT_URL

export async function fetchBeneficiairesFromSheet(): Promise<BeneficiairePayload[]> {
  if (!SCRIPT_URL) throw new Error("NEXT_PUBLIC_SHEETS_SCRIPT_URL non défini")
  // TODO: implémenter quand le Google Apps Script sera déployé.
  // const res = await fetch(`${SCRIPT_URL}?action=getBeneficiaires`)
  // const rows = await res.json() as Record<string, string>[]
  // return rows.map(rowToBeneficiaire)
  return []
}

export async function pushBeneficiaireToSheet(_b: BeneficiairePayload): Promise<void> {
  if (!SCRIPT_URL) throw new Error("NEXT_PUBLIC_SHEETS_SCRIPT_URL non défini")
  // TODO: await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "upsertBeneficiaire", row: beneficiaireToRow(_b) }) })
}

export async function fetchAteliersFromSheet(): Promise<AtelierPayload[]> {
  if (!SCRIPT_URL) throw new Error("NEXT_PUBLIC_SHEETS_SCRIPT_URL non défini")
  // TODO: idem fetchBeneficiairesFromSheet avec action=getAteliers
  return []
}

export async function pushAtelierToSheet(_a: AtelierPayload): Promise<void> {
  if (!SCRIPT_URL) throw new Error("NEXT_PUBLIC_SHEETS_SCRIPT_URL non défini")
  // TODO: idem avec action=upsertAtelier
}

export async function fetchGroupesFromSheet(): Promise<GroupePayload[]> {
  if (!SCRIPT_URL) throw new Error("NEXT_PUBLIC_SHEETS_SCRIPT_URL non défini")
  // TODO: idem avec action=getGroupes
  return []
}

export async function pushGroupeToSheet(_g: GroupePayload): Promise<void> {
  if (!SCRIPT_URL) throw new Error("NEXT_PUBLIC_SHEETS_SCRIPT_URL non défini")
  // TODO: idem avec action=upsertGroupe
}
