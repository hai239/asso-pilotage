// ──────────────────────────────────────────────
// Composition de groupes — algorithme du Lot 3
// ──────────────────────────────────────────────
// Prend en entrée la fiche descriptive d'un atelier (compétences ciblées,
// tranche d'âge, taille de groupe, mode homogène/hétérogène) et la liste
// des bénéficiaires (avec leurs notes du test initial), et produit un
// brouillon de groupes que les collaboratrices pourront ajuster.
//
// Principe de l'algorithme :
//   1. On filtre les bénéficiaires : statut actif, âge dans la tranche,
//      au moins une note initiale renseignée sur les thématiques cochées.
//   2. On regroupe par tranche d'âge (barrière dure : 6-9, 10-13, 14-18).
//   3. Dans chaque tranche, on trie par notes — tri lexicographique sur
//      les thématiques cochées (pas une moyenne, pour garder l'information
//      par dimension : deux profils avec la même moyenne mais des notes
//      très différentes sur chaque axe ne se retrouvent PAS ensemble).
//   4. Selon le mode :
//      • Homogène (défaut) : on slice le tri en N groupes consécutifs.
//      • Hétérogène : on distribue les bénéficiaires en round-robin.
//   5. On calcule pour chaque groupe le nombre d'encadrants requis si
//      l'atelier impose un ratio.

import type { Thematique, NotesPositionnement } from "./positionnement"
import type { FicheAtelier } from "./atelier"
import { encadrantsRequis, cycleForClasse, CYCLES, type CycleScolaire } from "./atelier"

// ──────────────────────────────────────────────
// Types publics
// ──────────────────────────────────────────────

export interface BeneficiairePourGroupage {
  id: number
  prenom: string
  nom: string
  dateNaissance: string
  statut: string
  positionnementInitial: NotesPositionnement
  /** Classe scolaire (INSCRIPTION "Niveau / Classe") — sert au cycle scolaire. */
  niveauClasse?: string
  /** Créneau de disponibilité (INSCRIPTION "Disponibilite") — mode "disponibilite". */
  disponibilite?: string
}

export interface GroupeBrouillon {
  /** Identifiant local (string pour éviter les collisions avec les ids existants). */
  id: string
  nom: string
  /** Cycle scolaire du groupe (null pour les parents / hors cycle). */
  cycle: CycleScolaire | null
  beneficiaireIds: number[]
  /** Encadrants requis selon le ratio de l'atelier — null si pas de ratio défini. */
  encadrantsRequis: number | null
}

/** Poids appliqué à une thématique dans le tri du groupage.
 *  "principale" passe en tête du tri lexicographique → la note sur cette
 *  thématique a le plus de poids dans le placement. */
export type Pondaration = "principale" | "secondaire"

export interface ParametresComposition {
  mode: "homogène" | "hétérogène"
  tailleGroupeCible: number
  competencesCiblees: Thematique[]
  /** Pondération par thématique. Manquante = "secondaire". */
  ponderation?: Partial<Record<Thematique, Pondaration>>
  /** Seuil bas de la note moyenne pour ne pas placer dans un groupe.
   *  Les bénéficiaires en dessous vont dans le bucket "outliers". */
  noteMin?: number | null
  /** Seuil haut symétrique au précédent. */
  noteMax?: number | null
  erreurs: string[]
}

export interface Brouillon {
  /** Identifiant de l'atelier à laquelle ce brouillon est rattaché. */
  atelierId: number
  /** Date de génération (ISO). */
  generedAt: string
  groupes: GroupeBrouillon[]
  /** Bénéficiaires non placés : aucune note initiale renseignée. */
  aEvaluer: number[]
  /** Bénéficiaires non placés : statut non actif. */
  exclusStatut: number[]
  /** Bénéficiaires non placés : moyenne hors des seuils noteMin/noteMax.
   *  À traiter à part (groupe adapté, suivi personnalisé). */
  outliers: number[]
  parametres: ParametresComposition
}

export interface OptionsComposition {
  ponderation?: Partial<Record<Thematique, Pondaration>>
  noteMin?: number | null
  noteMax?: number | null
}

// ──────────────────────────────────────────────
// Helpers internes
// ──────────────────────────────────────────────

function ageOf(dateNaissance: string): number | null {
  if (!dateNaissance) return null
  const an = new Date(dateNaissance).getFullYear()
  if (isNaN(an)) return null
  return new Date().getFullYear() - an
}

/** Au moins une note renseignée sur les thématiques ciblées. */
function aAuMoinsUneNote(b: BeneficiairePourGroupage, dims: Thematique[]): boolean {
  return dims.some(d => b.positionnementInitial[d] !== null)
}

/** Médiane d'une liste de notes (moyenne des deux valeurs centrales si effectif pair). */
function mediane(notes: number[]): number {
  if (notes.length === 0) return 0
  const trie = [...notes].sort((a, b) => a - b)
  const mid = Math.floor(trie.length / 2)
  return trie.length % 2 === 0 ? (trie[mid - 1] + trie[mid]) / 2 : trie[mid]
}

/** Écart-type de population (pas d'échantillon, on a l'exhaustivité du lot) autour d'un centre donné. */
function ecartType(notes: number[], centre: number): number {
  if (notes.length === 0) return 0
  const variance = notes.reduce((acc, n) => acc + (n - centre) ** 2, 0) / notes.length
  return Math.sqrt(variance)
}

/** Médiane + écart-type de la population du lot, par compétence ciblée.
 *  Sert à comparer les élèves ENTRE EUX sur une échelle commune, plutôt que
 *  sur les points bruts : deux compétences n'ont pas forcément la même
 *  dispersion dans la population (ex. compréhension écrite très étalée,
 *  expression orale resserrée) — sommer les points bruts fait dominer
 *  arbitrairement la compétence la plus dispersée. */
function statsParCompetence(
  lot: BeneficiairePourGroupage[],
  dims: Thematique[],
): Partial<Record<Thematique, { mediane: number; ecartType: number }>> {
  const stats: Partial<Record<Thematique, { mediane: number; ecartType: number }>> = {}
  for (const d of dims) {
    const notes = lot
      .map(b => b.positionnementInitial[d])
      .filter((n): n is number => n !== null)
    const med = mediane(notes)
    stats[d] = { mediane: med, ecartType: ecartType(notes, med) }
  }
  return stats
}

/** Score composite d'un bénéficiaire : moyenne, sur les compétences où il a
 *  une note, de son écart à la médiane de la population exprimé en
 *  écarts-types — `(note − médiane_pop) / écart-type_pop`. Rend les
 *  compétences comparables entre elles avant de les combiner (cf. décision
 *  produit : un score composé sur des points bruts ferait dominer la
 *  compétence la plus dispersée dans la population). */
function scoreComposite(
  b: BeneficiairePourGroupage,
  dims: Thematique[],
  stats: Partial<Record<Thematique, { mediane: number; ecartType: number }>>,
): number {
  const scores = dims
    .map(d => {
      const note = b.positionnementInitial[d]
      const s = stats[d]
      if (note === null || !s) return null
      return s.ecartType === 0 ? 0 : (note - s.mediane) / s.ecartType
    })
    .filter((s): s is number => s !== null)
  if (scores.length === 0) return 0
  return scores.reduce((a, s) => a + s, 0) / scores.length
}

/** Découpe une liste en N sous-listes consécutives de taille équilibrée. */
function sliceEnGroupes<T>(items: T[], nGroupes: number): T[][] {
  const result: T[][] = Array.from({ length: nGroupes }, () => [])
  const tailleBase = Math.floor(items.length / nGroupes)
  const reste = items.length % nGroupes
  let cursor = 0
  for (let i = 0; i < nGroupes; i++) {
    const taille = tailleBase + (i < reste ? 1 : 0)
    result[i] = items.slice(cursor, cursor + taille)
    cursor += taille
  }
  return result
}

/** Distribue une liste en N sous-listes en round-robin (mélange des niveaux). */
function repartirRoundRobin<T>(items: T[], nGroupes: number): T[][] {
  const result: T[][] = Array.from({ length: nGroupes }, () => [])
  items.forEach((item, i) => result[i % nGroupes].push(item))
  return result
}

/** Réordonne les thématiques cochées selon leur pondération.
 *  Les "principales" passent en tête → priorité dans le tri lexicographique. */
function ordonnerParPoids(
  dims: Thematique[],
  ponderation?: Partial<Record<Thematique, Pondaration>>,
): Thematique[] {
  if (!ponderation) return dims
  return [...dims].sort((a, b) => {
    const pa = ponderation[a] === "principale" ? 0 : 1
    const pb = ponderation[b] === "principale" ? 0 : 1
    return pa - pb
  })
}

/** Moyenne d'un bénéficiaire sur les thématiques ciblées (uniquement
 *  pour détecter les outliers — pas pour le groupage). */
function moyenneSur(
  b: BeneficiairePourGroupage,
  dims: Thematique[],
): number | null {
  const notes = dims
    .map(d => b.positionnementInitial[d])
    .filter((n): n is number => n !== null)
  if (notes.length === 0) return null
  return notes.reduce((a, b) => a + b, 0) / notes.length
}

/** Regroupe un lot par créneau de disponibilité (mode "disponibilite"). */
function grouperParDispo(
  lot: BeneficiairePourGroupage[],
): { key: string; membres: BeneficiairePourGroupage[] }[] {
  const map = new Map<string, BeneficiairePourGroupage[]>()
  for (const b of lot) {
    const key = (b.disponibilite ?? "").trim() || "Sans créneau"
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(b)
  }
  return [...map.entries()].map(([key, membres]) => ({ key, membres }))
}

// ──────────────────────────────────────────────
// API publique
// ──────────────────────────────────────────────

export function composerGroupes(
  atelier: Pick<
    FicheAtelier,
    "audience" | "competencesCiblees" | "tailleGroupeCible" | "ratioEncadrement" | "mixerNiveaux" | "modeGroupage"
  > & { id: number; titre: string },
  beneficiaires: BeneficiairePourGroupage[],
  options: OptionsComposition = {},
): Brouillon {
  // Parents : pas de cycle scolaire (les adultes n'ont pas de niveau de classe).
  const ignoreAge = atelier.audience === "parents"
  // Mode "disponibilite" (théâtre / marionnettes) : on regroupe par créneau,
  // sans notes ni compétences. Sinon "notes" : par niveau + cycle scolaire.
  const modeDispo = atelier.modeGroupage === "disponibilite"
  // Ordonner les thématiques cochées selon le poids (principales d'abord).
  // Cet ordre détermine la priorité du tri lexicographique : la note sur la
  // thématique principale a le plus de poids dans le placement.
  const dims = ordonnerParPoids(atelier.competencesCiblees, options.ponderation)
  const taille = atelier.tailleGroupeCible ?? 10
  const noteMin = options.noteMin ?? null
  const noteMax = options.noteMax ?? null
  const erreurs: string[] = []

  // ── 1. Validation des paramètres ──
  // En mode "disponibilite", les compétences ne sont pas requises (pas de notes).
  if (!modeDispo && dims.length === 0) {
    erreurs.push(
      "Aucune compétence ciblée n'est cochée pour cet atelier. Cochez au moins une thématique du test de positionnement pour que l'algorithme puisse comparer les notes.",
    )
  }
  if (taille < 2) {
    erreurs.push("La taille de groupe cible doit être au moins 2.")
  }

  // ── 2. Tri des bénéficiaires en buckets ──
  // Ordre des filtres : statut → notes manquantes → outliers (note hors
  // seuil) → éligibles. La barrière d'âge se fait exclusivement par CYCLE
  // SCOLAIRE (niveau de classe), plus loin — pas par tranche d'âge brute :
  // un élève peut être décalé d'âge par rapport à sa classe (redoublement…),
  // c'est la classe qui doit primer. Chaque cas exclu est rendu visible
  // côté UI, rien n'est perdu silencieusement.
  const exclusStatut: number[] = []
  const aEvaluer:     number[] = []
  const outliers:     number[] = []
  const eligibles:    BeneficiairePourGroupage[] = []

  for (const b of beneficiaires) {
    if (b.statut !== "actif") {
      exclusStatut.push(b.id)
      continue
    }
    // En mode "notes" seulement : exiger au moins une note + filtrer les outliers.
    if (!modeDispo) {
      if (dims.length > 0 && !aAuMoinsUneNote(b, dims)) {
        aEvaluer.push(b.id)
        continue
      }
      // Filtre outliers : moyenne hors des bornes → bucket à part.
      if (noteMin !== null || noteMax !== null) {
        const moy = moyenneSur(b, dims)
        if (moy !== null) {
          if ((noteMin !== null && moy < noteMin) || (noteMax !== null && moy > noteMax)) {
            outliers.push(b.id)
            continue
          }
        }
      }
    }
    eligibles.push(b)
  }

  // Si on est en erreur ou plus de bénéficiaires éligibles → brouillon vide
  if (erreurs.length > 0 || eligibles.length === 0) {
    return {
      atelierId: atelier.id,
      generedAt: new Date().toISOString(),
      groupes: [],
      aEvaluer,
      exclusStatut,
      outliers,
      parametres: {
        mode: atelier.mixerNiveaux ? "hétérogène" : "homogène",
        tailleGroupeCible: taille,
        competencesCiblees: dims,
        ponderation: options.ponderation,
        noteMin, noteMax,
        erreurs,
      },
    }
  }

  // ── 3. Regroupement ──
  // • Élèves : barrière dure de CYCLE scolaire (primaire+6e / collège+lycée),
  //   puis à l'intérieur de chaque cycle, découpe par notes OU par disponibilité.
  // • Parents : un seul lot (pas de cycle), découpé par notes OU disponibilité.
  const groupes: GroupeBrouillon[] = []
  let groupeIndex = 1

  /** Découpe un lot déjà homogène en cycle, selon le mode de groupage. */
  function pousserLot(lot: BeneficiairePourGroupage[], cycle: CycleScolaire | null, cycleLabel: string) {
    const prefixe = cycleLabel ? `${atelier.titre} · ${cycleLabel}` : atelier.titre
    if (modeDispo) {
      // Un groupe par créneau de disponibilité.
      for (const { key, membres } of grouperParDispo(lot)) {
        groupes.push({
          id: `${atelier.id}-${cycle ?? "x"}-${groupeIndex}`,
          nom: `${prefixe} · ${key}`,
          cycle,
          beneficiaireIds: membres.map(m => m.id),
          encadrantsRequis: encadrantsRequis(atelier.ratioEncadrement, membres.length),
        })
        groupeIndex++
      }
    } else {
      // Tri par score composite standardisé (médiane + écart-type de la
      // population du lot, cf. scoreComposite) puis découpe homogène (ou
      // round-robin si hétérogène). Les stats sont calculées sur CE lot
      // uniquement (déjà borné par cycle scolaire) — comparer un élève à une
      // population d'un autre cycle n'aurait pas de sens, ils ne seront de
      // toute façon jamais regroupés ensemble.
      const stats = statsParCompetence(lot, dims)
      const scores = new Map(lot.map(b => [b.id, scoreComposite(b, dims, stats)]))
      const trie = [...lot].sort((a, b) => scores.get(b.id)! - scores.get(a.id)!)
      const nGroupes = Math.max(1, Math.ceil(trie.length / taille))
      const repartition = atelier.mixerNiveaux
        ? repartirRoundRobin(trie, nGroupes)
        : sliceEnGroupes(trie, nGroupes)
      repartition.forEach(membres => {
        groupes.push({
          id: `${atelier.id}-${cycle ?? "x"}-${groupeIndex}`,
          nom: `${prefixe} · Groupe ${groupeIndex}`,
          cycle,
          beneficiaireIds: membres.map(m => m.id),
          encadrantsRequis: encadrantsRequis(atelier.ratioEncadrement, membres.length),
        })
        groupeIndex++
      })
    }
  }

  if (ignoreAge) {
    // Parents : pas de cycle.
    pousserLot(eligibles, null, "")
  } else {
    // Élèves : on répartit d'abord par cycle scolaire (barrière dure).
    const parCycle = new Map<CycleScolaire | "hors", BeneficiairePourGroupage[]>()
    for (const b of eligibles) {
      const age = ageOf(b.dateNaissance)
      const cy = cycleForClasse(b.niveauClasse, age) ?? "hors"
      if (!parCycle.has(cy)) parCycle.set(cy, [])
      parCycle.get(cy)!.push(b)
    }
    for (const cy of [...CYCLES.map(c => c.key), "hors" as const]) {
      const lot = parCycle.get(cy) ?? []
      if (lot.length === 0) continue
      const label = cy === "hors" ? "Hors cycle" : (CYCLES.find(c => c.key === cy)?.label ?? cy)
      pousserLot(lot, cy === "hors" ? null : cy, label)
    }
  }

  return {
    atelierId: atelier.id,
    generedAt: new Date().toISOString(),
    groupes,
    aEvaluer,
    exclusStatut,
    outliers,
    parametres: {
      mode: atelier.mixerNiveaux ? "hétérogène" : "homogène",
      tailleGroupeCible: taille,
      competencesCiblees: dims,
      ponderation: options.ponderation,
      noteMin, noteMax,
      erreurs,
    },
  }
}

// ──────────────────────────────────────────────
// Storage helpers (localStorage, en attendant le Google Sheet)
// ──────────────────────────────────────────────
// Un seul brouillon actif par atelier : `asso-brouillon-groupes-{atelierId}`.
// Régénérer = écraser. Valider = supprimer la clé après bascule dans les vrais groupes.

export const S_BROUILLON = (atelierId: number) => `asso-brouillon-groupes-${atelierId}`

export function saveBrouillon(b: Brouillon): void {
  if (typeof window === "undefined") return
  localStorage.setItem(S_BROUILLON(b.atelierId), JSON.stringify(b))
}

/** Comble les champs ajoutés après-coup (outliers, ponderation, noteMin, noteMax)
 *  pour qu'un brouillon stocké avant la mise à jour soit toujours lisible.
 *  Sans ça, l'UI plante sur `brouillon.outliers.length` (undefined). */
export function migrateBrouillon(raw: Partial<Brouillon> & { atelierId: number }): Brouillon {
  return {
    atelierId:   raw.atelierId,
    generedAt:   raw.generedAt   ?? new Date().toISOString(),
    groupes:     raw.groupes     ?? [],
    aEvaluer:    raw.aEvaluer    ?? [],
    exclusStatut:raw.exclusStatut?? [],
    outliers:    raw.outliers    ?? [],
    parametres: {
      mode:              raw.parametres?.mode              ?? "homogène",
      tailleGroupeCible: raw.parametres?.tailleGroupeCible ?? 10,
      competencesCiblees:raw.parametres?.competencesCiblees?? [],
      ponderation:       raw.parametres?.ponderation,
      noteMin:           raw.parametres?.noteMin           ?? null,
      noteMax:           raw.parametres?.noteMax           ?? null,
      erreurs:           raw.parametres?.erreurs           ?? [],
    },
  }
}

export function loadBrouillon(atelierId: number): Brouillon | null {
  if (typeof window === "undefined") return null
  try {
    const s = localStorage.getItem(S_BROUILLON(atelierId))
    if (!s) return null
    const raw = JSON.parse(s) as Partial<Brouillon> & { atelierId: number }
    return migrateBrouillon(raw)
  } catch {
    return null
  }
}

export function deleteBrouillon(atelierId: number): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(S_BROUILLON(atelierId))
}

/** Liste tous les brouillons actifs (utile pour l'écran "Brouillon groupes"). */
export function listBrouillons(): Brouillon[] {
  if (typeof window === "undefined") return []
  const result: Brouillon[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith("asso-brouillon-groupes-")) continue
    try {
      const s = localStorage.getItem(key)
      if (s) result.push(JSON.parse(s) as Brouillon)
    } catch { /* ignore */ }
  }
  return result
}
