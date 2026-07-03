"use client"

import { useState, useEffect, useRef } from "react"
import {
  THEMATIQUES,
  type NotesPositionnement,
  type Thematique,
  type TypeBeneficiaire,
} from "@/lib/positionnement"
import type { FicheAtelier } from "@/lib/atelier"
import {
  composerGroupes,
  saveBrouillon,
  loadBrouillon,
  deleteBrouillon,
  libelleNiveaux,
  estNiveauAlpha,
  type Brouillon,
  type GroupeBrouillon,
  type BeneficiairePourGroupage,
  type OptionsComposition,
  type Pondaration,
} from "@/lib/group-composer"
import SlideOver, { Field, Input, SaveButton, DeleteButton } from "@/components/SlideOver"
import {
  Shuffle, RotateCcw, CheckCircle2, AlertTriangle,
  GraduationCap, UserCheck, Sparkles, Settings, X, Plus,
} from "lucide-react"

// ──────────────────────────────────────────────
// Types — alignés avec app/ateliers/page.tsx
// ──────────────────────────────────────────────
type SessionStatut = "planifié" | "en cours" | "terminé" | "annulé"
type StatutBenef   = "actif" | "diplômé" | "abandon"
type NiveauBenef   = "débutant" | "intermédiaire" | "avancé"
type TypeGroupe    = "niveau" | "âge" | "mixte"

interface Session extends FicheAtelier {
  id: number
  titre: string
  description: string
  date: string
  heure: string
  duree: string
  salle: string
  beneficiaireIds: number[]
  benevoleIds: number[]
  statut: SessionStatut
}

interface Beneficiaire {
  id: number
  type: TypeBeneficiaire
  prenom: string
  nom: string
  dateNaissance: string
  email: string
  telephone: string
  nomParent: string
  telephoneParent: string
  emailParent: string
  dateInscription: string
  positionnementInitial: NotesPositionnement
  positionnementFinal:   NotesPositionnement
  niveau: NiveauBenef
  notes: string
  statut: StatutBenef
  parentIds: number[]
  niveauClasse?: string
  disponibilite?: string
  niveauCECRL?: string
  typeApprenant?: string
}

interface Groupe {
  id: number
  nom: string
  /** Court suffixe (niveau CECRL, créneau ou numéro) — devient la colonne
   *  "Groupe" de l'atelier créé côté parent, cf. GroupeBrouillon.label. */
  label: string
  type: TypeGroupe
  description: string
  beneficiaireIds: number[]
  atelierId: number | null
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function toGroupingInput(b: Beneficiaire): BeneficiairePourGroupage {
  return {
    id: b.id, prenom: b.prenom, nom: b.nom,
    dateNaissance: b.dateNaissance, statut: b.statut,
    positionnementInitial: b.positionnementInitial,
    niveauClasse: b.niveauClasse,
    disponibilite: b.disponibilite,
    niveauCECRL: b.niveauCECRL,
  }
}

function computeAge(dn: string): number | null {
  if (!dn) return null
  const an = new Date(dn).getFullYear()
  return isNaN(an) ? null : new Date().getFullYear() - an
}

// ──────────────────────────────────────────────
// Composant principal
// ──────────────────────────────────────────────
export default function BrouillonGroupesTab(props: {
  sessions: Session[]
  beneficiaires: Beneficiaire[]
  /** Appelé quand la collaboratrice valide un brouillon. Le parent doit
   *  remplacer les groupes deja rattachés à cet atelier (et non simplement
   *  ajouter) — sinon, une nouvelle validation crée un doublon de groupes
   *  pour la même fiche atelier. La promesse DOIT rejeter en cas d'échec
   *  (écriture Sheet) pour que le brouillon local ne soit pas effacé avant
   *  que les groupes ne soient réellement créés côté serveur. */
  onGroupesValides: (newGroupes: Groupe[], atelierId: number) => Promise<void>
  /** Met à jour la session source pour que l'onglet Ateliers reflète la
   *  composition validée (beneficiaireIds = union des groupes du brouillon). */
  onAtelierBenefsUpdated: (atelierId: number, beneficiaireIds: number[]) => void
  /** Optionnel : bascule automatiquement sur un autre onglet après validation
   *  (par défaut on bascule sur "Groupes" pour montrer le résultat). */
  onValidated?: (nbGroupes: number) => void
}) {
  const {
    sessions, beneficiaires, onGroupesValides, onAtelierBenefsUpdated, onValidated,
  } = props

  /** Brouillons indexés par atelierId. */
  const [brouillons, setBrouillons] = useState<Record<number, Brouillon | null>>({})

  /** Marque l'atelier qui vient d'être (re)généré pour pulser visuellement
   *  la carte. Reset automatique au bout de 2,5 s. */
  const [justRegen, setJustRegen] = useState<number | null>(null)
  useEffect(() => {
    if (justRegen === null) return
    const t = setTimeout(() => setJustRegen(null), 2500)
    return () => clearTimeout(t)
  }, [justRegen])

  /** Message affiché quand une action manuelle (drag & drop, +Ajouter) tente
   *  de mélanger le niveau Alpha avec un autre niveau — bloquée par
   *  melangeAlphaInterdit. Reset automatique au bout de 4 s. */
  const [melangeBloque, setMelangeBloque] = useState<string | null>(null)
  useEffect(() => {
    if (melangeBloque === null) return
    const t = setTimeout(() => setMelangeBloque(null), 4000)
    return () => clearTimeout(t)
  }, [melangeBloque])

  // SlideOver "régénérer avec paramètres"
  interface ParamForm {
    tailleGroupeCible: number
    /** Pondération par thématique cochée sur l'atelier. */
    ponderation: Partial<Record<Thematique, Pondaration>>
    /** Seuils pour le filtre outliers. Vides = pas de filtre. */
    noteMin: string
    noteMax: string
  }
  const [paramSlide, setParamSlide] = useState(false)
  const [paramAtelier, setParamAtelier] = useState<Session | null>(null)
  const [paramForm, setParamForm] = useState<ParamForm>({
    tailleGroupeCible: 10,
    ponderation: {}, noteMin: "", noteMax: "",
  })

  // Drag & drop
  const dragRef = useRef<{ benefId: number; fromGroupeId: string; atelierId: number } | null>(null)

  // SlideOver "détails du groupe" — ouverte au clic sur une carte de groupe.
  const [groupeSlide, setGroupeSlide] = useState(false)
  const [viewingGroupe, setViewingGroupe] = useState<{ atelierId: number; groupeId: string } | null>(null)

  /** Atelier dont la validation est en cours (écriture Sheet, ~5-10s) —
   *  désactive le bouton pour éviter un double-clic pendant l'attente. */
  const [validatingId, setValidatingId] = useState<number | null>(null)

  // Chargement des brouillons existants pour chaque session
  useEffect(() => {
    const map: Record<number, Brouillon | null> = {}
    for (const s of sessions) {
      map[s.id] = loadBrouillon(s.id)
    }
    setBrouillons(map)
  }, [sessions])

  // ── Actions ──
  function genererPour(
    atelier: Session,
    override?: Partial<FicheAtelier>,
    options?: OptionsComposition,
  ) {
    const fiche = { ...atelier, ...override }
    const brouillon = composerGroupes(fiche, beneficiaires.map(toGroupingInput), options)
    saveBrouillon(brouillon)
    setBrouillons(m => ({ ...m, [atelier.id]: brouillon }))
    // Highlight visuel temporaire sur la carte concernée.
    setJustRegen(atelier.id)
  }

  function ouvrirParametres(atelier: Session) {
    setParamAtelier(atelier)
    // Pré-remplit avec les paramètres du brouillon courant si présent,
    // sinon avec les valeurs déclarées sur la fiche atelier.
    const courant = brouillons[atelier.id]
    setParamForm({
      tailleGroupeCible: courant?.parametres.tailleGroupeCible ?? atelier.tailleGroupeCible ?? 10,
      ponderation:       courant?.parametres.ponderation ?? {},
      noteMin:           courant?.parametres.noteMin != null ? String(courant.parametres.noteMin) : "",
      noteMax:           courant?.parametres.noteMax != null ? String(courant.parametres.noteMax) : "",
    })
    setParamSlide(true)
  }

  function validerParametres() {
    if (!paramAtelier) return
    const noteMin = paramForm.noteMin === "" ? null : Number(paramForm.noteMin)
    const noteMax = paramForm.noteMax === "" ? null : Number(paramForm.noteMax)
    genererPour(
      paramAtelier,
      {
        tailleGroupeCible: paramForm.tailleGroupeCible,
      },
      {
        ponderation: paramForm.ponderation,
        noteMin, noteMax,
      },
    )
    setParamSlide(false)
  }

  // ── Modification manuelle ──

  /** Recalcule le nom d'un groupe créé à la main (`manuel: true`) d'après le
   *  niveau réel de ses membres actuels — un groupe manuel rempli d'élèves de
   *  niveau A1 s'appelle "Groupe A1", pas "Groupe manuel N" (les membres y sont
   *  normalement du même niveau puisqu'ajoutés à la main pour cette raison).
   *  Ignoré pour les groupes générés par l'algorithme, dont le nom reste figé
   *  à la composition initiale. Sans niveau déductible (0 membre, ou aucun
   *  niveau/note connue), le nom précédent est conservé tel quel. */
  function renommerSiManuel(atelierId: number, groupe: GroupeBrouillon): GroupeBrouillon {
    if (!groupe.manuel) return groupe
    const atelier = sessions.find(s => s.id === atelierId)
    if (!atelier) return groupe
    const membres = groupe.beneficiaireIds.map(benefById).filter((b): b is Beneficiaire => !!b)
    const label = libelleNiveaux(membres.map(toGroupingInput), atelier.competencesCiblees)
    if (!label) return groupe
    return { ...groupe, nom: `${atelier.titre} · Groupe ${label}`, label }
  }

  /** Empêche toute action manuelle (drag & drop, +Ajouter) de mélanger un
   *  bénéficiaire de niveau Alpha avec un groupe non-Alpha (et inversement) —
   *  règle produit stricte : "le groupe Alpha doit être strictement seul,
   *  aucun mélange possible". L'algorithme la respecte déjà nativement (cf.
   *  niveauxAdjacents dans lib/group-composer.ts) ; ce garde-fou couvre les
   *  actions manuelles, qui la contournaient jusqu'ici. Groupe vide → toujours
   *  autorisé (rien à mélanger pour l'instant). */
  function melangeAlphaInterdit(atelierId: number, groupe: GroupeBrouillon, benefId: number): boolean {
    const atelier = sessions.find(s => s.id === atelierId)
    const candidat = benefById(benefId)
    if (!atelier || !candidat) return false
    const dims = atelier.competencesCiblees
    const candidatEstAlpha = estNiveauAlpha(toGroupingInput(candidat), dims)
    const membres = groupe.beneficiaireIds.map(benefById).filter((b): b is Beneficiaire => !!b)
    if (membres.length === 0) return false
    const groupeEstAlpha = membres.some(m => estNiveauAlpha(toGroupingInput(m), dims))
    return candidatEstAlpha !== groupeEstAlpha
  }

  function removeMember(atelierId: number, groupeId: string, benefId: number) {
    const b = brouillons[atelierId]
    if (!b) return
    const newGroupes = b.groupes.map(g =>
      g.id === groupeId
        ? renommerSiManuel(atelierId, { ...g, beneficiaireIds: g.beneficiaireIds.filter(id => id !== benefId) })
        : g,
    )
    const updated: Brouillon = { ...b, groupes: newGroupes }
    saveBrouillon(updated)
    setBrouillons(m => ({ ...m, [atelierId]: updated }))
  }

  function addMember(atelierId: number, groupeId: string, benefId: number) {
    const b = brouillons[atelierId]
    if (!b) return
    const groupe = b.groupes.find(g => g.id === groupeId)
    if (groupe && melangeAlphaInterdit(atelierId, groupe, benefId)) {
      setMelangeBloque("Le niveau Alpha ne peut pas être mélangé avec un autre niveau.")
      return
    }
    const newGroupes = b.groupes.map(g =>
      g.id === groupeId
        ? (g.beneficiaireIds.includes(benefId)
            ? g
            : renommerSiManuel(atelierId, { ...g, beneficiaireIds: [...g.beneficiaireIds, benefId] }))
        : g,
    )
    const updated: Brouillon = { ...b, groupes: newGroupes }
    saveBrouillon(updated)
    setBrouillons(m => ({ ...m, [atelierId]: updated }))
  }

  /** Ajoute un groupe vide au brouillon — pour scinder manuellement quand
   *  l'algorithme n'a produit qu'un seul groupe (effectif trop faible pour
   *  découper en plusieurs paliers, cf. lib/group-composer.ts). Se remplit
   *  ensuite comme n'importe quel groupe généré (glisser-déposer, +Ajouter) ;
   *  son nom se met à jour tout seul dès que le niveau de ses membres devient
   *  déductible (cf. renommerSiManuel). */
  function ajouterGroupeManuel(atelierId: number) {
    const b = brouillons[atelierId]
    if (!b) return
    const n = b.groupes.length + 1
    const nouveau: GroupeBrouillon = {
      id: `${atelierId}-manuel-${Date.now()}`,
      nom: `Groupe manuel ${n}`,
      label: `Manuel ${n}`,
      cycle: null,
      beneficiaireIds: [],
      manuel: true,
    }
    const updated: Brouillon = { ...b, groupes: [...b.groupes, nouveau] }
    saveBrouillon(updated)
    setBrouillons(m => ({ ...m, [atelierId]: updated }))
  }

  /** Renvoie les bénéficiaires actuellement non placés dans un groupe du brouillon
   *  (mais éligibles à l'atelier — la pool des "libres" pour le bouton +Ajouter). */
  function getBenefsLibres(brouillon: Brouillon): Beneficiaire[] {
    const placed = new Set(brouillon.groupes.flatMap(g => g.beneficiaireIds))
    // Les bénéficiaires actifs non placés dans un groupe.
    // On laisse la collaboratrice juger : elle peut vouloir ajouter manuellement
    // un bénéficiaire "à évaluer", "outlier" ou "hors tranche" malgré le filtre.
    return beneficiaires
      .filter(b => b.statut === "actif" && !placed.has(b.id))
      .sort((a, b) => a.prenom.localeCompare(b.prenom))
  }

  function supprimerBrouillon(atelierId: number) {
    deleteBrouillon(atelierId)
    setBrouillons(m => ({ ...m, [atelierId]: null }))
  }

  function ouvrirGroupe(atelierId: number, groupeId: string) {
    setViewingGroupe({ atelierId, groupeId })
    setGroupeSlide(true)
  }

  /** Supprime uniquement ce groupe du brouillon — ses membres redeviennent
   *  "libres" (ils ne sont plus comptés dans aucun groupe). */
  function supprimerGroupe(atelierId: number, groupeId: string) {
    const b = brouillons[atelierId]
    if (!b) return
    const updated: Brouillon = { ...b, groupes: b.groupes.filter(g => g.id !== groupeId) }
    saveBrouillon(updated)
    setBrouillons(m => ({ ...m, [atelierId]: updated }))
    setGroupeSlide(false)
  }

  async function validerComposition(atelier: Session, brouillon: Brouillon) {
    if (validatingId !== null) return
    const baseId = Date.now()
    // On lit les groupes depuis l'état courant du brouillon, donc tous les
    // ajouts/suppressions manuels et drag-drops faits avant le clic Valider
    // sont bien inclus.
    const nouveaux: Groupe[] = brouillon.groupes.map((g, i) => ({
      id: baseId + i,
      nom: g.nom,
      label: g.label,
      type: "niveau",
      description: `Auto-généré depuis "${atelier.titre}" — ${g.beneficiaireIds.length} bénéficiaires`,
      beneficiaireIds: [...g.beneficiaireIds],
      atelierId: atelier.id,
    }))

    setValidatingId(atelier.id)
    try {
      // Attend la création effective des groupes côté Sheet avant de toucher
      // au brouillon local — sinon un échec réseau efface le brouillon alors
      // que rien n'a été créé côté serveur (carte qui se vide sans raison).
      await onGroupesValides(nouveaux, atelier.id)

      // Synchronise la session source : ses beneficiaireIds deviennent
      // l'union de tous les bénéficiaires placés dans les groupes validés.
      // C'est cette union qui sera affichée dans la carte de l'atelier
      // (sous-onglet Ateliers) et utilisée par les pages aval (émargement…).
      const benefsUnion = Array.from(new Set(nouveaux.flatMap(g => g.beneficiaireIds)))
      onAtelierBenefsUpdated(atelier.id, benefsUnion)

      supprimerBrouillon(atelier.id)
      // Bascule sur l'onglet Groupes pour montrer le résultat immédiatement.
      onValidated?.(nouveaux.length)
    } catch {
      // Échec de l'écriture Sheet : le brouillon reste intact, on ne bascule
      // pas d'onglet. Le parent affiche déjà un toast d'erreur.
    } finally {
      setValidatingId(null)
    }
  }

  // ── Drag & drop ──
  function onDragStart(benefId: number, fromGroupeId: string, atelierId: number) {
    dragRef.current = { benefId, fromGroupeId, atelierId }
  }
  function onDropOnGroupe(toGroupeId: string, atelierId: number) {
    const drag = dragRef.current
    if (!drag || drag.atelierId !== atelierId) return
    if (drag.fromGroupeId === toGroupeId) return
    const b = brouillons[atelierId]
    if (!b) return
    const toGroupe = b.groupes.find(g => g.id === toGroupeId)
    if (toGroupe && melangeAlphaInterdit(atelierId, toGroupe, drag.benefId)) {
      setMelangeBloque("Le niveau Alpha ne peut pas être mélangé avec un autre niveau.")
      dragRef.current = null
      return
    }

    const newGroupes: GroupeBrouillon[] = b.groupes.map(g => {
      if (g.id === drag.fromGroupeId) {
        return renommerSiManuel(atelierId, { ...g, beneficiaireIds: g.beneficiaireIds.filter(id => id !== drag.benefId) })
      }
      if (g.id === toGroupeId) {
        if (g.beneficiaireIds.includes(drag.benefId)) return g
        return renommerSiManuel(atelierId, { ...g, beneficiaireIds: [...g.beneficiaireIds, drag.benefId] })
      }
      return g
    })
    const updated: Brouillon = { ...b, groupes: newGroupes }
    saveBrouillon(updated)
    setBrouillons(m => ({ ...m, [atelierId]: updated }))
    dragRef.current = null
  }

  function benefById(id: number): Beneficiaire | undefined {
    return beneficiaires.find(b => b.id === id)
  }

  // Ateliers visibles dans le brouillon : pas encore composés (aucun membre —
  // dès qu'un atelier est validé, ses lignes-groupes ont des beneficiaireIds
  // et n'ont plus leur place ici, seulement dans l'onglet Groupes), et on
  // exclut le théâtre / marionnettes (mode "disponibilite") — leurs élèves
  // sont choisis directement dans la fiche, sans passer par un brouillon.
  // Tri par ordre de création décroissant : le dernier atelier créé en premier.
  const ateliersAffichables = sessions
    .filter(s =>
      s.statut !== "terminé" && s.statut !== "annulé" &&
      s.modeGroupage !== "disponibilite" && s.beneficiaireIds.length === 0,
    )
    .sort((a, b) => b.id - a.id)

  if (ateliersAffichables.length === 0) {
    return (
      <div className="text-center py-20 bg-surface rounded-xl border border-border">
        <div className="mx-auto mb-4 inline-flex p-3 rounded-full bg-slate-50">
          <Shuffle size={36} className="text-slate-300" />
        </div>
        <p className="font-semibold text-foreground">Aucun atelier à venir</p>
        <p className="text-sm text-muted mt-1 max-w-md mx-auto">
          Crée d&apos;abord un atelier depuis le sous-onglet Ateliers pour pouvoir générer un brouillon de groupes.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {melangeBloque && (
        <div className="flex items-center gap-2 rounded-xl border border-alert/30 bg-red-50 px-4 py-2.5 text-sm text-alert">
          <AlertTriangle size={16} className="shrink-0" />
          {melangeBloque}
        </div>
      )}
      {ateliersAffichables.map(atelier => {
        const brouillon = brouillons[atelier.id]
        // En mode "disponibilité" (théâtre/marionnettes), les compétences ne sont
        // pas requises : le groupage se fait par créneau, sans notes.
        const pasDeCompetence = atelier.modeGroupage !== "disponibilite" && atelier.competencesCiblees.length === 0

        return (
          <article
            key={atelier.id}
            className={`bg-surface rounded-xl border overflow-hidden transition-all duration-300 ${
              justRegen === atelier.id
                ? "border-ateliers ring-4 ring-ateliers/20"
                : "border-border"
            }`}
          >
            {/* Header atelier */}
            <header className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-foreground">{atelier.titre}</h2>
                  <span className="text-[10px] text-muted">{new Date(atelier.date).toLocaleDateString("fr-FR")}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {atelier.competencesCiblees.map(c => {
                    const t = THEMATIQUES.find(x => x.key === c)
                    return t ? (
                      <span key={c} className="text-[10px] bg-ateliers/10 text-ateliers-dark px-1.5 py-0.5 rounded font-medium">
                        {t.short}
                      </span>
                    ) : null
                  })}
                  {atelier.tailleGroupeCible !== null && (
                    <span className="text-[10px] text-muted">· groupes de {atelier.tailleGroupeCible}</span>
                  )}
                </div>
              </div>
              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                {brouillon ? (
                  <>
                    <button
                      onClick={() => ouvrirParametres(atelier)}
                      disabled={validatingId === atelier.id}
                      className="flex items-center gap-1.5 text-xs font-medium border border-border bg-surface text-foreground px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Settings size={12} /> Régénérer
                    </button>
                    <button
                      onClick={() => validerComposition(atelier, brouillon)}
                      disabled={validatingId === atelier.id}
                      className="flex items-center gap-1.5 text-xs font-medium bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
                    >
                      {validatingId === atelier.id
                        ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <CheckCircle2 size={12} />}
                      {validatingId === atelier.id ? "Validation en cours…" : "Valider la composition"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => genererPour(atelier)}
                    disabled={pasDeCompetence}
                    title={pasDeCompetence ? "Coche au moins une compétence ciblée sur l'atelier" : "Générer un brouillon"}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      pasDeCompetence
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : atelier.audience === "parents"
                          ? "bg-communication text-white hover:bg-communication-dark"
                          : "bg-ateliers text-white hover:bg-ateliers-dark"
                    }`}
                  >
                    <Sparkles size={12} /> Générer un brouillon
                  </button>
                )}
              </div>
            </header>

            {/* Corps */}
            <div className="px-5 py-4">
              {pasDeCompetence && !brouillon && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertTriangle size={12} />
                  Aucune compétence ciblée n&apos;est cochée pour cet atelier. Édite l&apos;atelier pour en cocher au moins une.
                </p>
              )}

              {brouillon && brouillon.parametres.erreurs.length > 0 && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                  <p className="font-semibold mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Génération impossible</p>
                  <ul className="list-disc pl-4">
                    {brouillon.parametres.erreurs.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              {brouillon && brouillon.groupes.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {brouillon.groupes.map(g => (
                    <GroupeCard
                      key={g.id}
                      groupe={g}
                      atelierId={atelier.id}
                      audience={atelier.audience}
                      dims={atelier.competencesCiblees}
                      benefById={benefById}
                      onDragStart={onDragStart}
                      onDrop={onDropOnGroupe}
                      onRemoveMember={benefId => removeMember(atelier.id, g.id, benefId)}
                      onAddMember={benefId => addMember(atelier.id, g.id, benefId)}
                      onOpen={() => ouvrirGroupe(atelier.id, g.id)}
                      onDelete={() => supprimerGroupe(atelier.id, g.id)}
                      benefsLibres={getBenefsLibres(brouillon)}
                    />
                  ))}
                </div>
              )}

              {/* Création manuelle — pour scinder à la main quand l'algorithme
                  n'a produit qu'un seul groupe (petit effectif, cf. Parents). */}
              {brouillon && (
                <button
                  type="button"
                  onClick={() => ajouterGroupeManuel(atelier.id)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-muted border border-dashed border-border rounded-xl py-2.5 hover:border-ateliers hover:text-ateliers-dark transition-colors"
                >
                  <Plus size={12} /> Créer un nouveau groupe
                </button>
              )}

              {/* Buckets — bénéficiaires non placés. */}
              {brouillon && (brouillon.aEvaluer.length + brouillon.outliers.length > 0) && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {brouillon.aEvaluer.length > 0 && (
                    <BucketCard
                      color="amber"
                      icon={<AlertTriangle size={11} />}
                      titre={`À évaluer (${brouillon.aEvaluer.length})`}
                      sousTitre="Aucune note initiale renseignée"
                      membres={brouillon.aEvaluer.map(id => benefById(id)).filter((b): b is Beneficiaire => !!b)}
                    />
                  )}
                  {brouillon.outliers.length > 0 && (
                    <BucketCard
                      color="red"
                      icon={<AlertTriangle size={11} />}
                      titre={`Outliers (${brouillon.outliers.length})`}
                      sousTitre={(() => {
                        const min = brouillon.parametres.noteMin
                        const max = brouillon.parametres.noteMax
                        if (min != null && max != null) return `Moyenne hors de [${min}, ${max}]`
                        if (min != null) return `Moyenne < ${min}`
                        if (max != null) return `Moyenne > ${max}`
                        return "Hors des seuils définis"
                      })()}
                      membres={brouillon.outliers.map(id => benefById(id)).filter((b): b is Beneficiaire => !!b)}
                    />
                  )}
                </div>
              )}

              {brouillon && (
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted">
                  <span className={justRegen === atelier.id ? "text-ateliers-dark font-semibold" : ""}>
                    {justRegen === atelier.id ? "✨ Régénéré à l'instant" : `Généré le ${new Date(brouillon.generedAt).toLocaleString("fr-FR")}`}
                  </span>
                  <button onClick={() => supprimerBrouillon(atelier.id)} className="hover:text-foreground hover:underline">
                    <RotateCcw size={10} className="inline mr-1" /> Abandonner ce brouillon
                  </button>
                </div>
              )}
            </div>
          </article>
        )
      })}

      {/* ── SlideOver paramètres de régénération ── */}
      <SlideOver
        open={paramSlide}
        onClose={() => setParamSlide(false)}
        title="Régénérer le brouillon"
        subtitle={paramAtelier?.titre}
        width="md"
      >
        <form onSubmit={e => { e.preventDefault(); validerParametres() }} className="flex flex-col gap-4">
          <p className="text-xs text-muted">
            Modifie les paramètres ci-dessous pour relancer l&apos;algorithme.
            Le brouillon actuel sera remplacé.
          </p>

          {/* ── Taille de groupe + mode ── */}
          <Field label="Taille de groupe cible">
            <Input
              type="number" min={2} max={30}
              value={paramForm.tailleGroupeCible}
              onChange={e => setParamForm(f => ({ ...f, tailleGroupeCible: Number(e.target.value) }))}
            />
          </Field>

          {/* ── Pondération des thématiques ── */}
          {paramAtelier && paramAtelier.competencesCiblees.length >= 2 && (
            <div className="rounded-xl border border-border bg-surface/50 p-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                Pondération des compétences
              </p>
              <p className="text-[11px] text-muted mb-3">
                Marque la compétence <b>principale</b> pour qu&apos;elle pèse le plus dans le placement.
                Les autres deviennent secondaires.
              </p>
              <div className="flex flex-col gap-2">
                {paramAtelier.competencesCiblees.map(c => {
                  const t = THEMATIQUES.find(x => x.key === c)
                  if (!t) return null
                  const current = paramForm.ponderation[c] ?? "secondaire"
                  return (
                    <div key={c} className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-foreground flex-1 min-w-0">{t.label}</span>
                      <div className="flex gap-1">
                        {(["principale", "secondaire"] as const).map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setParamForm(f => ({
                              ...f, ponderation: { ...f.ponderation, [c]: p },
                            }))}
                            className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                              current === p
                                ? p === "principale"
                                  ? "bg-ateliers text-white"
                                  : "bg-slate-200 text-slate-700"
                                : "bg-surface text-muted border border-border hover:border-ateliers"
                            }`}
                          >
                            {p === "principale" ? "Principale" : "Secondaire"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Outliers ── */}
          <div className="rounded-xl border border-border bg-surface/50 p-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
              Filtrer les outliers
            </p>
            <p className="text-[11px] text-muted mb-3">
              Les bénéficiaires dont la <b>moyenne</b> sur les compétences ciblées est en dehors
              de l&apos;intervalle ci-dessous ne sont pas placés automatiquement — ils sont
              isolés dans un bucket à part pour décision pédagogique. Laisse vide pour ne pas filtrer.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Note minimum (sur 20)">
                <Input
                  type="number" min={0} max={20}
                  value={paramForm.noteMin}
                  onChange={e => setParamForm(f => ({ ...f, noteMin: e.target.value }))}
                />
              </Field>
              <Field label="Note maximum (sur 20)">
                <Input
                  type="number" min={0} max={20}
                  value={paramForm.noteMax}
                  onChange={e => setParamForm(f => ({ ...f, noteMax: e.target.value }))}
                />
              </Field>
            </div>
          </div>

          <p className="text-[11px] text-muted bg-slate-50 rounded-lg px-3 py-2">
            💡 Les bénéficiaires aux notes proches sont regroupés (rythme pédagogique adapté).
          </p>
          <SaveButton accent="ateliers" />
        </form>
      </SlideOver>

      {/* ── SlideOver détails du groupe (clic sur une carte de brouillon) ── */}
      {(() => {
        const atelier   = viewingGroupe ? sessions.find(s => s.id === viewingGroupe.atelierId) : undefined
        const brouillon = viewingGroupe ? brouillons[viewingGroupe.atelierId] : undefined
        const groupe    = brouillon?.groupes.find(g => g.id === viewingGroupe?.groupeId)
        const benefsLibresPourAjout = brouillon ? getBenefsLibres(brouillon) : []
        const isParents = atelier?.audience === "parents"
        return (
          <SlideOver
            open={groupeSlide}
            onClose={() => setGroupeSlide(false)}
            title={groupe?.nom ?? "Groupe"}
            subtitle={atelier?.titre}
            width="md"
          >
            {atelier && groupe && viewingGroupe && brouillon && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                    {isParents ? "Parents" : "Élèves"} du groupe ({groupe.beneficiaireIds.length})
                  </p>
                  {groupe.beneficiaireIds.length === 0 ? (
                    <p className="text-sm text-muted italic">Aucun membre dans ce groupe.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {groupe.beneficiaireIds.map(id => {
                        const b = benefById(id)
                        if (!b) return null
                        return (
                          <li key={id} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-border">
                            <span className="text-sm font-medium text-foreground">{b.prenom} {b.nom}</span>
                            <button
                              type="button"
                              onClick={() => removeMember(viewingGroupe.atelierId, viewingGroupe.groupeId, id)}
                              className="p-1 rounded text-red-600 hover:bg-red-50"
                              aria-label={`Retirer ${b.prenom} ${b.nom} du groupe`}
                            >
                              <X size={13} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                    Ajouter {isParents ? "un parent" : "un élève"}
                  </p>
                  {benefsLibresPourAjout.length === 0 ? (
                    <p className="text-sm text-muted italic">Aucun bénéficiaire libre à ajouter.</p>
                  ) : (
                    <ul className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                      {benefsLibresPourAjout.map(b => (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => addMember(viewingGroupe.atelierId, viewingGroupe.groupeId, b.id)}
                            className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg hover:bg-slate-50"
                          >
                            <Plus size={12} className="text-muted" />
                            <span className="font-medium text-foreground">{b.prenom} {b.nom}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-2 border-t border-border">
                  <DeleteButton
                    label="Supprimer ce groupe"
                    onClick={() => supprimerGroupe(viewingGroupe.atelierId, viewingGroupe.groupeId)}
                  />
                </div>
              </div>
            )}
          </SlideOver>
        )
      })()}
    </div>
  )
}

// ──────────────────────────────────────────────
// Sous-composants
// ──────────────────────────────────────────────

function GroupeCard(props: {
  groupe: GroupeBrouillon
  atelierId: number
  /** Audience de l'atelier — pilote l'iconographie et le wording (élève vs parent)
   *  ainsi que l'affichage de l'âge (caché pour les parents). */
  audience: FicheAtelier["audience"]
  dims: typeof THEMATIQUES[number]["key"][]
  benefById: (id: number) => Beneficiaire | undefined
  onDragStart: (benefId: number, fromGroupeId: string, atelierId: number) => void
  onDrop: (toGroupeId: string, atelierId: number) => void
  /** Retirer un membre — déclenché par la croix au hover sur la ligne. */
  onRemoveMember: (benefId: number) => void
  /** Ajouter un membre — déclenché depuis la popover du bouton "+ Ajouter". */
  onAddMember: (benefId: number) => void
  /** Bénéficiaires actifs non placés ailleurs (pool dans la popover). */
  benefsLibres: Beneficiaire[]
  /** Ouvre la vue détaillée du groupe (clic sur l'en-tête de la carte). */
  onOpen: () => void
  /** Supprime ce groupe du brouillon directement (raccourci sans ouvrir le détail). */
  onDelete: () => void
}) {
  const {
    groupe, atelierId, audience, dims, benefById, onDragStart, onDrop,
    onRemoveMember, onAddMember, benefsLibres, onOpen, onDelete,
  } = props
  const [over, setOver] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const isParents       = audience === "parents"
  const benefIcon       = isParents ? UserCheck : GraduationCap
  const benefIconColor  = isParents ? "text-communication-dark" : "text-ateliers-dark"
  const benefIconColorMuted = isParents ? "text-communication-dark/60" : "text-muted"
  const addLabel        = isParents ? "Ajouter un parent" : "Ajouter un élève"
  const Icon            = benefIcon

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop(groupe.id, atelierId) }}
      className={`rounded-xl border bg-surface transition-colors ${
        over ? "border-ateliers ring-2 ring-ateliers/20" : "border-border"
      }`}
    >
      <header
        onClick={onOpen}
        className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 flex-wrap cursor-pointer hover:bg-slate-50"
        title="Voir le détail du groupe"
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{groupe.nom}</p>
          <p className="text-[10px] text-muted">{groupe.beneficiaireIds.length} bénéficiaire{groupe.beneficiaireIds.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete() }}
            title="Supprimer ce groupe"
            aria-label={`Supprimer le groupe ${groupe.nom}`}
            className="p-1 rounded text-muted hover:bg-red-50 hover:text-red-600"
          >
            <X size={12} />
          </button>
        </div>
      </header>

      <ul className="px-2 py-2 flex flex-col gap-1 min-h-[60px]">
        {groupe.beneficiaireIds.length === 0 && (
          <li className="text-[11px] text-muted italic text-center py-3">
            Glisse ou ajoute un bénéficiaire.
          </li>
        )}
        {groupe.beneficiaireIds.map(id => {
          const b = benefById(id)
          if (!b) return null
          const age = computeAge(b.dateNaissance)
          return (
            <li
              key={b.id}
              draggable
              onDragStart={() => onDragStart(b.id, groupe.id, atelierId)}
              className="group/member flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-50 cursor-grab active:cursor-grabbing"
            >
              <Icon size={12} className={`${benefIconColor} shrink-0`} />
              <span className="text-xs font-medium text-foreground">{b.prenom} {b.nom}</span>
              {!isParents && age !== null && <span className="text-[10px] text-muted">{age} ans</span>}
              <span className="ml-auto flex items-center gap-1">
                {dims.map(d => {
                  const n = b.positionnementInitial[d]
                  return (
                    <span key={d} className="text-[10px] text-muted tabular-nums">
                      {n ?? "—"}
                    </span>
                  )
                })}
                {/* Croix toujours présente, mais visible seulement au hover de la ligne
                    pour ne pas surcharger visuellement. Stop propagation pour ne
                    pas déclencher le drag. */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onRemoveMember(b.id) }}
                  onMouseDown={e => e.stopPropagation()}
                  title={`Retirer ${b.prenom} ${b.nom} du groupe`}
                  className="ml-1 p-1 rounded text-red-600 hover:bg-red-50 opacity-0 group-hover/member:opacity-100 transition-opacity"
                  aria-label={`Retirer ${b.prenom} ${b.nom}`}
                >
                  <X size={11} />
                </button>
              </span>
            </li>
          )
        })}
      </ul>

      {/* Bouton "+ Ajouter un élève" toujours visible en bas du groupe */}
      <div className="px-2 pb-2 border-t border-border/50 pt-2 relative">
        <button
          type="button"
          onClick={() => setAddOpen(o => !o)}
          className={`w-full flex items-center justify-center gap-1.5 text-[11px] font-medium rounded-md py-1.5 ${
            isParents
              ? "text-communication-dark hover:bg-communication-light/50"
              : "text-ateliers-dark hover:bg-ateliers-light/50"
          }`}
        >
          <Plus size={11} /> {addLabel}
        </button>
        {addOpen && (
          <div className="absolute left-2 right-2 top-full mt-1 z-10 bg-surface border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
            <header className="px-3 py-1.5 border-b border-border flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                Bénéficiaires libres
              </span>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="text-muted hover:text-foreground"
                aria-label="Fermer"
              >
                <X size={11} />
              </button>
            </header>
            {benefsLibres.length === 0 ? (
              <p className="text-[11px] text-muted italic text-center py-4">
                Aucun bénéficiaire libre à ajouter.
              </p>
            ) : (
              <ul className="py-1">
                {benefsLibres.map(b => {
                  const age = computeAge(b.dateNaissance)
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => { onAddMember(b.id); setAddOpen(false) }}
                        className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50"
                      >
                        <Icon size={11} className={`${benefIconColorMuted} shrink-0`} />
                        <span className="font-medium text-foreground">{b.prenom} {b.nom}</span>
                        {!isParents && age !== null && <span className="text-[10px] text-muted">{age} ans</span>}
                        <span className="ml-auto flex gap-1">
                          {dims.map(d => {
                            const n = b.positionnementInitial[d]
                            return (
                              <span key={d} className="text-[10px] text-muted tabular-nums">
                                {n ?? "—"}
                              </span>
                            )
                          })}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BucketCard(props: {
  color: "amber" | "slate" | "red"
  icon: React.ReactNode
  titre: string
  sousTitre: string
  membres: Beneficiaire[]
}) {
  const { color, icon, titre, sousTitre, membres } = props
  const palette = {
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    red:   "bg-red-50 border-red-200 text-red-800",
  }[color]
  return (
    <div className={`rounded-xl border p-3 ${palette}`}>
      <p className="text-xs font-semibold flex items-center gap-1.5 mb-0.5">{icon} {titre}</p>
      <p className="text-[10px] opacity-80 mb-2">{sousTitre}</p>
      <div className="flex flex-wrap gap-1">
        {membres.map(b => (
          <span key={b.id} className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded">
            {b.prenom} {b.nom}
          </span>
        ))}
      </div>
    </div>
  )
}
