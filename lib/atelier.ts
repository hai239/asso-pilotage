// ──────────────────────────────────────────────
// Fiche atelier — types & helpers (Lot 2 du chantier 2.1)
// ──────────────────────────────────────────────
// Étend la structure historique des sessions d'atelier avec :
//   • compétences ciblées (cf. lib/positionnement.ts → 4 thématiques)
//   • public ciblé (tranche d'âge, taille de groupe, ratio encadrement)
//   • organisation (tâches, besoins, étapes, personnes impliquées)
//   • mode de groupage (homogène par défaut, hétérogène en option)
//
// Ces champs alimenteront l'algorithme de composition de groupes (Lot 3).

import type { Thematique } from "./positionnement"

// ──────────────────────────────────────────────
// Tranches d'âge — barrières dures pour la composition de groupes
// ──────────────────────────────────────────────
// Décision projet : un bénéficiaire de 7 ans et un de 18 ans ne peuvent
// pas être dans le même groupe même s'ils ont des notes similaires.
// L'algorithme refuse tout mélange entre tranches.

export type TrancheAge = "6-9" | "10-13" | "14-18"

export const TRANCHES_AGE: { key: TrancheAge; min: number; max: number; label: string }[] = [
  { key: "6-9",   min: 6,  max: 9,  label: "6-9 ans" },
  { key: "10-13", min: 10, max: 13, label: "10-13 ans" },
  { key: "14-18", min: 14, max: 18, label: "14-18 ans" },
]

/** Retourne la tranche dans laquelle un âge tombe (null si hors plage). */
export function trancheFor(age: number | null): TrancheAge | null {
  if (age === null) return null
  const t = TRANCHES_AGE.find(t => age >= t.min && age <= t.max)
  return t?.key ?? null
}

// ──────────────────────────────────────────────
// Cycle scolaire — barrière dure pour la composition des groupes ÉLÈVES
// ──────────────────────────────────────────────
// Règle métier (décidée avec l'association) :
//   • "primaire_6e"   = élémentaire (CP→CM2) + 6e
//   • "college_lycee" = 5e, 4e, 3e + lycée (2de, 1re, Tle, CAP…)
// Un élève d'un cycle ne se mélange jamais avec l'autre, même à notes égales.
// Le cycle se déduit de la classe (INSCRIPTION "Niveau / Classe") ; à défaut,
// on retombe sur l'âge (≤ 11 ans → primaire+6e, ≥ 12 → collège+lycée).

export type CycleScolaire = "primaire_6e" | "college_lycee"

export const CYCLES: { key: CycleScolaire; label: string }[] = [
  { key: "primaire_6e",   label: "Élémentaire + 6e" },
  { key: "college_lycee", label: "Collège + Lycée" },
]

/** Niveau d'école fin — sert à filtrer les élèves proposés selon le type d'atelier :
 *  marionnettes = élémentaire + 6e ; théâtre = collège + lycée + 6e. */
export type NiveauEcole = "elementaire" | "6e" | "college" | "lycee"

export function niveauEcole(classe: string | undefined | null): NiveauEcole | null {
  const c = (classe ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "")
  if (!c) return null
  if (/(^|[^0-9])6e(me)?([^0-9]|$)/.test(c)) return "6e"
  if (/(cp|ce1|ce2|cm1|cm2|maternelle|gs|ms|ps)/.test(c)) return "elementaire"
  if (/(5e|5eme|4e|4eme|3e|3eme)/.test(c)) return "college"
  if (/(2de|2nde|seconde|1re|1ere|premiere|terminale|tle|cap|lyc|bac)/.test(c)) return "lycee"
  return null
}

/** Déduit le cycle scolaire d'un élève depuis sa classe (prioritaire) ou son âge. */
export function cycleForClasse(classe: string | undefined | null, age: number | null): CycleScolaire | null {
  const c = (classe ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "")
  if (c) {
    // 6e testé côté primaire AVANT le collège pour éviter tout faux positif.
    if (/(cp|ce1|ce2|cm1|cm2|6e|6eme|maternelle)/.test(c)) return "primaire_6e"
    if (/(5e|5eme|4e|4eme|3e|3eme|2de|2nde|seconde|1re|1ere|premiere|terminale|tle|cap|lyc|bac)/.test(c)) return "college_lycee"
  }
  if (age !== null) return age <= 11 ? "primaire_6e" : "college_lycee"
  return null
}

// ──────────────────────────────────────────────
// Fiche descriptive — nouveaux champs étendus
// ──────────────────────────────────────────────

/** Public visé par un atelier. "eleves" (enfants) par défaut pour
 *  rétrocompatibilité — les anciens ateliers étaient tous pour les élèves. */
export type AudienceAtelier = "eleves" | "parents"

/** Couleur visuelle assignée à l'atelier — sert à colorer les blocs de la
 *  vue Groupes et les avatars membres. Palette fixe pour garantir la
 *  cohérence (accessibilité : couleur jamais seule, toujours + texte + icône). */
export type CouleurAtelier =
  | "teal" | "emerald" | "amber" | "orange" | "violet" | "slate"

export const COULEURS_ATELIER: { key: CouleurAtelier; label: string }[] = [
  { key: "teal",    label: "Turquoise" },
  { key: "emerald", label: "Vert" },
  { key: "amber",   label: "Doré" },
  { key: "orange",  label: "Orange" },
  { key: "violet",  label: "Violet" },
  { key: "slate",   label: "Gris" },
]

export interface FicheAtelier {
  /** Public visé : determine la pool de bénéficiaires utilisée par l'algo
   *  de composition. */
  audience: AudienceAtelier

  /** Couleur visuelle de l'atelier (vue Groupes). Défaut : "teal". */
  couleur: CouleurAtelier

  /** Thématiques évaluées par le test de positionnement qui sont pertinentes
   *  pour cet atelier. L'algorithme se base sur les notes de ces thématiques. */
  competencesCiblees: Thematique[]

  /** Tranche d'âge cible. null = pas de borne. */
  ageMin: number | null
  ageMax: number | null

  /** Nombre de bénéficiaires visé par groupe. null = pas de contrainte. */
  tailleGroupeCible: number | null

  /** 1 encadrant pour N bénéficiaires. null = pas de ratio strict.
   *  Ex : atelier exposé → 2 (1 bénévole pour 2 bénéficiaires). */
  ratioEncadrement: number | null

  /** Mode de groupage. False (défaut) = homogène (niveaux proches ensemble).
   *  True = hétérogène (mélange volontaire des niveaux). */
  mixerNiveaux: boolean

  /** Critère de composition des groupes :
   *  • "notes" (défaut) → par niveau (notes du positionnement) + cycle scolaire ;
   *  • "disponibilite" → par créneau de disponibilité, sans notes (théâtre/marionnettes). */
  modeGroupage: "notes" | "disponibilite"

  // Organisation libre — alimentent la fiche descriptive, pas l'algo
  taches: string[]
  besoins: string[]
  etapes: string[]
  personnesImpliqueesIds: number[]

  /** Période sur laquelle s'étend l'atelier — saisie libre.
   *  Ex : "Vacances de printemps 2026", "du 13 au 24 avril", "2 semaines".
   *  Vide si l'atelier tient sur une seule séance. */
  periode: string
}

// ──────────────────────────────────────────────
// Valeurs par défaut + migration douce
// ──────────────────────────────────────────────

export function emptyFiche(): FicheAtelier {
  return {
    audience: "eleves",
    couleur: "teal",
    competencesCiblees: [],
    ageMin: null,
    ageMax: null,
    tailleGroupeCible: null,
    ratioEncadrement: null,
    mixerNiveaux: false,
    modeGroupage: "notes",
    taches: [],
    besoins: [],
    etapes: [],
    personnesImpliqueesIds: [],
    periode: "",
  }
}

/** Forme élargie acceptée par migrateFiche pour rester compatible avec
 *  les anciennes sauvegardes localStorage qui portaient encore dateDebut
 *  et dateFin (deux selecteurs de date) au lieu d'un champ libre. */
interface FicheAtelierLegacy extends Partial<FicheAtelier> {
  dateDebut?: string | null
  dateFin?:   string | null
}

/** Une session qui vient de l'ancien format n'a aucun de ces champs.
 *  On comble les manques pour que la page ne crashe pas. */
export function migrateFiche<T extends FicheAtelierLegacy>(s: T): T & FicheAtelier {
  // Migration de la période : si on a deux dates au lieu d'une string,
  // on construit une chaîne lisible "du X au Y" via formatPeriode.
  let periode = s.periode
  if (periode === undefined) {
    periode = s.dateDebut && s.dateFin ? formatPeriode(s.dateDebut, s.dateFin) : ""
  }
  return {
    ...s,
    audience:               s.audience               ?? "eleves",
    couleur:                s.couleur                ?? "teal",
    competencesCiblees:     s.competencesCiblees     ?? [],
    ageMin:                 s.ageMin                 ?? null,
    ageMax:                 s.ageMax                 ?? null,
    tailleGroupeCible:      s.tailleGroupeCible      ?? null,
    ratioEncadrement:       s.ratioEncadrement       ?? null,
    mixerNiveaux:           s.mixerNiveaux           ?? false,
    modeGroupage:           s.modeGroupage           ?? "notes",
    taches:                 s.taches                 ?? [],
    besoins:                s.besoins                ?? [],
    etapes:                 s.etapes                 ?? [],
    personnesImpliqueesIds: s.personnesImpliqueesIds ?? [],
    periode,
  }
}

/** Calcule le nombre d'encadrants requis pour un groupe donné.
 *  null si l'atelier n'impose pas de ratio. */
export function encadrantsRequis(
  ratio: number | null,
  tailleGroupe: number,
): number | null {
  if (ratio === null || ratio <= 0) return null
  return Math.ceil(tailleGroupe / ratio)
}

// ──────────────────────────────────────────────
// Période d'atelier (helper de migration)
// ──────────────────────────────────────────────
// Depuis la refonte du formulaire, la période est un champ texte libre
// directement édité par l'utilisateur. Ce helper reste exposé pour la
// migration des anciennes sauvegardes qui portaient deux dates (dateDebut
// et dateFin) — on les concatène en une chaîne lisible.

/** Formate "2026-04-13" + "2026-04-24" → "du 13 au 24 avril 2026".
 *  Renvoie une chaîne vide si une des dates est manquante ou invalide. */
export function formatPeriode(dateDebut: string | null, dateFin: string | null): string {
  if (!dateDebut || !dateFin) return ""
  const d = new Date(dateDebut)
  const f = new Date(dateFin)
  if (isNaN(d.getTime()) || isNaN(f.getTime()) || d > f) return ""
  const mois = (date: Date) => date.toLocaleDateString("fr-FR", { month: "long" })
  if (d.getMonth() === f.getMonth() && d.getFullYear() === f.getFullYear()) {
    return `du ${d.getDate()} au ${f.getDate()} ${mois(f)} ${f.getFullYear()}`
  }
  return `du ${d.getDate()} ${mois(d)} au ${f.getDate()} ${mois(f)} ${f.getFullYear()}`
}
