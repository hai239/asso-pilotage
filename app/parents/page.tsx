"use client"

import { useState, useEffect } from "react"
import { ateliers as ateliersMock } from "@/lib/mock-data"
import {
  THEMATIQUES,
  emptyNotes,
  isEmpty as notesIsEmpty,
  moyenne as notesMoyenne,
  migrate as migrateBenef,
  type NotesPositionnement,
  type Thematique,
  type TypeBeneficiaire,
} from "@/lib/positionnement"
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import { Pencil, Search, GraduationCap, Users, UserCheck, X, AlertTriangle } from "lucide-react"

// ──────────────────────────────────────────────
// Types (alignés avec /beneficiaires — un seul modèle Beneficiaire avec
// discriminateur `type`. La page /parents filtre type=parent.)
// ──────────────────────────────────────────────
type NiveauBenef = "débutant" | "intermédiaire" | "avancé"
type StatutBenef = "actif" | "diplômé" | "abandon"

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
}

// ──────────────────────────────────────────────
// Storage — partagé avec /beneficiaires (un seul modèle de données).
// ──────────────────────────────────────────────
const S_BENEF = "asso-beneficiaires"

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}

// ──────────────────────────────────────────────
// Helpers (mêmes que /beneficiaires, ré-utilisés tels quels pour cohérence)
// ──────────────────────────────────────────────
function computeAge(dateNaissance: string): number | null {
  if (!dateNaissance) return null
  return new Date().getFullYear() - new Date(dateNaissance).getFullYear()
}

function deriveNiveau(notes: NotesPositionnement): NiveauBenef {
  const m = notesMoyenne(notes)
  if (m === null) return "débutant"
  if (m <= 10) return "débutant"
  if (m <= 16) return "intermédiaire"
  return "avancé"
}

function noteColor(note: number | null): string {
  if (note === null) return "bg-slate-100 text-slate-500"
  if (note <= 7)  return "bg-red-100 text-red-700"
  if (note <= 13) return "bg-orange-100 text-orange-700"
  return "bg-green-100 text-green-700"
}

function setNote(notes: NotesPositionnement, key: Thematique, value: string): NotesPositionnement {
  const v = value === "" ? null : Math.max(0, Math.min(20, Number(value)))
  return { ...notes, [key]: v }
}

function initials(prenom: string, nom: string): string {
  return `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase()
}

const niveauStyle: Record<NiveauBenef, string> = {
  "débutant":      "bg-absences-light text-absences-dark",
  "intermédiaire": "bg-ateliers-light text-ateliers-dark",
  "avancé":        "bg-finances-light text-finances-dark",
}

const statutStyle: Record<StatutBenef, string> = {
  "actif":    "bg-finances-light text-finances-dark",
  "diplômé":  "bg-ateliers-light text-ateliers-dark",
  "abandon":  "bg-slate-100 text-slate-500",
}

const empty = (): Omit<Beneficiaire, "id"> => ({
  type: "parent",
  prenom: "", nom: "", dateNaissance: "", email: "", telephone: "",
  nomParent: "", telephoneParent: "", emailParent: "",
  dateInscription: new Date().toISOString().split("T")[0],
  positionnementInitial: emptyNotes(),
  positionnementFinal:   emptyNotes(),
  niveau: "débutant", notes: "", statut: "actif",
  parentIds: [],
})

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function ParentsPage() {
  const [beneficiaires, setBenef] = useState<Beneficiaire[]>(ateliersMock.beneficiaires as Beneficiaire[])

  const [search, setSearch]               = useState("")
  const [filterStatut, setFilterStatut]   = useState<StatutBenef | "tous">("tous")
  const [filterNiveau, setFilterNiveau]   = useState<NiveauBenef | "tous">("tous")

  const [slideOpen, setSlideOpen] = useState(false)
  const [editing, setEditing]     = useState<Beneficiaire | null>(null)
  const [form, setForm]           = useState<Omit<Beneficiaire, "id">>(empty())
  // Liste des enfants liés à ce parent (ids des Beneficiaires type=eleve).
  // Cet état est local au SlideOver et propage au save vers les parentIds
  // des élèves concernés (le lien est porté côté élève, jamais dupliqué).
  const [selectedEnfantIds, setSelectedEnfantIds] = useState<number[]>([])

  useEffect(() => {
    const raw = load<Beneficiaire[]>(S_BENEF, ateliersMock.beneficiaires as Beneficiaire[])
    setBenef(raw.map(b => migrateBenef(b) as Beneficiaire))
  }, [])

  function persist(data: Beneficiaire[]) {
    setBenef(data)
    localStorage.setItem(S_BENEF, JSON.stringify(data))
  }

  /** Renvoie les ids des élèves qui ont ce parent dans leur parentIds. */
  function getEnfantIds(parentId: number): number[] {
    return beneficiaires
      .filter(b => b.type === "eleve" && b.parentIds.includes(parentId))
      .map(b => b.id)
  }

  function openNew() {
    setEditing(null)
    setForm(empty())
    setSelectedEnfantIds([])
    setSlideOpen(true)
  }

  function openEdit(b: Beneficiaire) {
    setEditing(b)
    setForm({ ...b })
    setSelectedEnfantIds(getEnfantIds(b.id))
    setSlideOpen(true)
  }

  function handleSave() {
    // 1. Sauvegarde / création de la fiche parent elle-même.
    const id = editing ? editing.id : Date.now()
    const fiche: Beneficiaire = { ...form, id }
    let updated = editing
      ? beneficiaires.map(x => x.id === editing.id ? fiche : x)
      : [...beneficiaires, fiche]

    // 2. Synchronisation du lien parent ↔ enfant.
    // Le lien est porté côté élève (parentIds). On compare l'état précédent
    // (calculé) à l'état souhaité (selectedEnfantIds) et on met à jour les
    // élèves concernés en cascade.
    const previousEnfantIds = editing ? getEnfantIds(editing.id) : []
    const ajoutes  = selectedEnfantIds.filter(eid => !previousEnfantIds.includes(eid))
    const retires  = previousEnfantIds.filter(eid => !selectedEnfantIds.includes(eid))

    updated = updated.map(b => {
      if (b.type !== "eleve") return b
      if (ajoutes.includes(b.id) && !b.parentIds.includes(id)) {
        return { ...b, parentIds: [...b.parentIds, id] }
      }
      if (retires.includes(b.id)) {
        return { ...b, parentIds: b.parentIds.filter(p => p !== id) }
      }
      return b
    })

    persist(updated)
    setSlideOpen(false)
  }

  function handleDelete() {
    if (!editing) return
    // Avant de supprimer le parent, on enlève la référence dans les parentIds
    // des élèves qui le pointaient.
    const updated = beneficiaires
      .filter(x => x.id !== editing.id)
      .map(b => b.type === "eleve" && b.parentIds.includes(editing.id)
        ? { ...b, parentIds: b.parentIds.filter(p => p !== editing.id) }
        : b,
      )
    persist(updated)
    setSlideOpen(false)
  }

  // Pool des élèves disponibles pour la liaison (uniquement actifs et diplômés
  // — on évite les "abandon" qui sont moins pertinents).
  const elevesDisponibles = beneficiaires
    .filter(b => b.type === "eleve")
    .sort((a, b) => a.nom.localeCompare(b.nom))

  // Filters — la liste affichée n'inclut QUE les parents.
  const filtered = beneficiaires.filter(b => {
    if (b.type !== "parent") return false
    const q = search.toLowerCase()
    const matchSearch = !q ||
      b.prenom.toLowerCase().includes(q) ||
      b.nom.toLowerCase().includes(q)
    const matchStatut = filterStatut === "tous" || b.statut === filterStatut
    const matchNiveau = filterNiveau === "tous" || b.niveau === filterNiveau
    return matchSearch && matchStatut && matchNiveau
  })

  const suggestedNiveau = deriveNiveau(form.positionnementInitial)
  const moyInitial      = notesMoyenne(form.positionnementInitial)
  const aEvaluer        = notesIsEmpty(form.positionnementInitial)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Parents</h1>
          <p className="text-sm text-muted mt-1">
            Fiches des parents bénéficiaires (ateliers adultes) et liens vers les enfants.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
        >
          <UserCheck size={14} /> Nouveau parent
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-communication-light rounded-xl border border-communication/20 p-4">
          <p className="text-3xl font-bold text-communication-dark">{filtered.length}</p>
          <p className="text-sm text-communication-dark/70 mt-1">Parents enregistrés</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">
            {filtered.filter(p => getEnfantIds(p.id).length > 0).length}
          </p>
          <p className="text-sm text-muted mt-1">Avec enfant(s) rattaché(s)</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">
            {beneficiaires.filter(b => b.type === "parent" && b.statut === "actif").length}
          </p>
          <p className="text-sm text-muted mt-1">Actifs</p>
        </div>
      </div>

      {/* Search + filters (pattern unifié) */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Rechercher par nom ou prénom…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-ateliers/30"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground" aria-label="Effacer">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {(["tous", "actif", "diplômé", "abandon"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatut(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterStatut === s ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
            >
              {s === "tous" ? "Tous statuts" : s}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {(["tous", "débutant", "intermédiaire", "avancé"] as const).map(n => (
            <button key={n} onClick={() => setFilterNiveau(n)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterNiveau === n ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
            >
              {n === "tous" ? "Tous niveaux" : n}
            </button>
          ))}
        </div>

        {(search !== "" || filterStatut !== "tous" || filterNiveau !== "tous") && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
            <button
              type="button"
              onClick={() => { setSearch(""); setFilterStatut("tous"); setFilterNiveau("tous") }}
              className="text-xs text-muted hover:text-foreground hover:underline"
            >
              Réinitialiser
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <UserCheck size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">{search ? "Aucun résultat pour cette recherche." : "Aucun parent enregistré."}</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-xs text-muted">{filtered.length} parent{filtered.length > 1 ? "s" : ""}</p>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map(p => {
              const age      = computeAge(p.dateNaissance)
              const enfants  = beneficiaires.filter(b => b.type === "eleve" && b.parentIds.includes(p.id))
              return (
                <li key={p.id} className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50 group">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-communication-light flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-communication-dark">{initials(p.prenom, p.nom)}</span>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{p.prenom} {p.nom}</p>
                      {age !== null && <span className="text-xs text-muted">{age} ans</span>}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statutStyle[p.statut]}`}>{p.statut}</span>
                    </div>

                    {/* Notes / niveau */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {notesIsEmpty(p.positionnementInitial) ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                          <AlertTriangle size={10} /> À évaluer avant attribution
                        </span>
                      ) : (
                        <>
                          {THEMATIQUES.map(t => {
                            const n = p.positionnementInitial[t.key]
                            return (
                              <span
                                key={t.key}
                                title={t.label}
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${noteColor(n)}`}
                              >
                                {t.short.replace(/^[A-Z]\w+\. /, "")} {n ?? "—"}
                              </span>
                            )
                          })}
                        </>
                      )}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${niveauStyle[p.niveau]}`}>
                        {p.niveau}
                      </span>
                    </div>

                    {/* Enfants rattachés */}
                    {enfants.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <GraduationCap size={11} className="text-ateliers-dark" />
                        {enfants.map(e => (
                          <span key={e.id} className="text-[10px] bg-ateliers-light text-ateliers-dark px-1.5 py-0.5 rounded-full">
                            {e.prenom} {e.nom}
                          </span>
                        ))}
                      </div>
                    )}

                    {p.notes && (
                      <p className="text-xs text-slate-400 italic mt-1 line-clamp-1">{p.notes}</p>
                    )}
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1"
                  >
                    <Pencil size={13} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── SlideOver ── */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editing ? `${editing.prenom} ${editing.nom}` : "Nouveau parent"}
        subtitle="Fiche parent (adulte bénéficiaire)"
        width="lg"
      >
        <form onSubmit={e => { e.preventDefault(); handleSave() }} className="flex flex-col gap-5">

          {/* Section Identité */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Users size={12} /> Identité
            </p>
            <div className="flex flex-col gap-3">
              <FormRow>
                <Field label="Prénom" required>
                  <Input placeholder="Farida" value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
                </Field>
                <Field label="Nom" required>
                  <Input placeholder="A." value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
                </Field>
              </FormRow>
              <Field label="Date de naissance">
                <div className="flex items-center gap-3">
                  <Input
                    type="date"
                    value={form.dateNaissance}
                    onChange={e => setForm(f => ({ ...f, dateNaissance: e.target.value }))}
                  />
                  {(() => {
                    const age = computeAge(form.dateNaissance)
                    if (age === null) return null
                    return (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-communication-light text-communication-dark shrink-0">
                        → {age} an{age > 1 ? "s" : ""}
                      </span>
                    )
                  })()}
                </div>
              </Field>
              <FormRow>
                <Field label="Email">
                  <Input type="email" placeholder="farida@email.fr" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </Field>
                <Field label="Téléphone">
                  <Input placeholder="06 12 34 56 78" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
                </Field>
              </FormRow>
            </div>
          </div>

          {/* Section Enfants rattachés (liens vers les fiches Eleve) */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <GraduationCap size={12} /> Enfants rattachés
            </p>
            <p className="text-[11px] text-muted mb-3">
              Sélectionne les élèves dont cette personne est le parent.
              La modification est propagée automatiquement aux fiches Élève.
            </p>
            {elevesDisponibles.length === 0 ? (
              <p className="text-[11px] text-muted italic">
                Aucun élève enregistré. Ajoute des élèves dans l&apos;onglet Bénéficiaires.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {elevesDisponibles.map(e => {
                  const sel = selectedEnfantIds.includes(e.id)
                  return (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => setSelectedEnfantIds(prev =>
                        sel ? prev.filter(id => id !== e.id) : [...prev, e.id],
                      )}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                        sel
                          ? "bg-ateliers text-white border-ateliers"
                          : "bg-surface text-muted border-border hover:border-ateliers"
                      }`}
                    >
                      {e.prenom} {e.nom}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Section Inscription */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Inscription</p>
            <div className="flex flex-col gap-3">
              <Field label="Date d'inscription">
                <Input type="date" value={form.dateInscription} onChange={e => setForm(f => ({ ...f, dateInscription: e.target.value }))} />
              </Field>
              <FormRow>
                <Field label="Niveau">
                  <Select value={form.niveau} onChange={e => setForm(f => ({ ...f, niveau: e.target.value as NiveauBenef }))}>
                    <option value="débutant">Débutant</option>
                    <option value="intermédiaire">Intermédiaire</option>
                    <option value="avancé">Avancé</option>
                  </Select>
                </Field>
                <Field label="Statut">
                  <Select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as StatutBenef }))}>
                    <option value="actif">Actif</option>
                    <option value="diplômé">Diplômé</option>
                    <option value="abandon">Abandon</option>
                  </Select>
                </Field>
              </FormRow>
            </div>
          </div>

          {/* Section Test de positionnement (mêmes 4 thématiques que pour les élèves) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                Test de positionnement
              </p>
              {aEvaluer && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                  <AlertTriangle size={10} /> À évaluer avant attribution
                </span>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface/50 p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-foreground">
                  Initial <span className="text-muted font-normal">— sert à composer les groupes</span>
                </p>
                {moyInitial !== null && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${noteColor(Math.round(moyInitial))}`}>
                    moy {moyInitial.toFixed(1)} → {suggestedNiveau}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {THEMATIQUES.map(t => (
                  <Field key={t.key} label={t.label}>
                    <Input
                      type="number" min={0} max={20} placeholder="—/20"
                      value={form.positionnementInitial[t.key] ?? ""}
                      onChange={e => {
                        const next = setNote(form.positionnementInitial, t.key, e.target.value)
                        setForm(f => ({ ...f, positionnementInitial: next, niveau: deriveNiveau(next) }))
                      }}
                    />
                  </Field>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface/50 p-3">
              <p className="text-[11px] font-semibold text-foreground mb-2">
                Final <span className="text-muted font-normal">— mesure d&apos;impact (optionnel)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {THEMATIQUES.map(t => (
                  <Field key={t.key} label={t.label}>
                    <Input
                      type="number" min={0} max={20} placeholder="—/20"
                      value={form.positionnementFinal[t.key] ?? ""}
                      onChange={e => {
                        const next = setNote(form.positionnementFinal, t.key, e.target.value)
                        setForm(f => ({ ...f, positionnementFinal: next }))
                      }}
                    />
                  </Field>
                ))}
              </div>
            </div>
          </div>

          {/* Section Notes */}
          <Field label="Notes">
            <Textarea
              rows={3}
              placeholder="Observations, besoins particuliers…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </Field>

          <SaveButton />
          {editing && <DeleteButton onClick={handleDelete} />}
        </form>
      </SlideOver>
    </div>
  )
}
