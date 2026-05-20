"use client"

import { useState, useMemo } from "react"
import { ateliers as ateliersMock } from "@/lib/mock-data"
import { MapPin, AlertTriangle, Shuffle, Users, CalendarDays, GraduationCap, Pencil } from "lucide-react"
import SlideOver, { Field, Input, Select, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"

// Apprenante avec notes persistées (notes peuvent être null après édition)
interface Apprenante {
  id: number
  nom: string
  groupe: string
  noteLogique: number | null
  notePratique: number | null
  noteProjet: number | null
  presences: number
  absences: number
  notes?: string
}
const STORAGE_APP = "asso-apprenantes"

function loadApp(): Apprenante[] {
  if (typeof window === "undefined") return ateliersMock.apprenantes as Apprenante[]
  try { const s = localStorage.getItem(STORAGE_APP); return s ? JSON.parse(s) : ateliersMock.apprenantes } catch { return ateliersMock.apprenantes as Apprenante[] }
}

const ateliers = ateliersMock

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function noteColor(n: number | null) {
  if (n === null) return "text-muted"
  if (n >= 16) return "text-finances-dark font-semibold"
  if (n >= 12) return "text-ateliers-dark font-semibold"
  if (n >= 8)  return "text-absences-dark font-semibold"
  return "text-alert font-semibold"
}

function moyenne(a: Apprenante) {
  const notes = [a.noteLogique, a.notePratique, a.noteProjet].filter((n): n is number => n !== null)
  if (notes.length === 0) return null
  return Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10
}

function niveauLabel(moy: number | null) {
  if (moy === null) return { label: "N/A",         color: "bg-slate-100 text-slate-500" }
  if (moy >= 16)    return { label: "Excellent",    color: "bg-finances-light text-finances-dark" }
  if (moy >= 12)    return { label: "Bon niveau",   color: "bg-ateliers-light text-ateliers-dark" }
  if (moy >= 8)     return { label: "En progression", color: "bg-absences-light text-absences-dark" }
  return              { label: "Soutien nécessaire", color: "bg-red-50 text-alert" }
}

const GROUPES = ["Débutants", "Intermédiaires", "Avancées"] as const
type Groupe = (typeof GROUPES)[number]

const GROUPE_COLORS: Record<Groupe, string> = {
  "Débutants":      "bg-absences-light border-absences text-absences-dark",
  "Intermédiaires": "bg-ateliers-light border-ateliers text-ateliers-dark",
  "Avancées":       "bg-finances-light border-finances text-finances-dark",
}

// Auto-balance algorithm: répartit les apprenantes équitablement par niveau
function autoBalance(apprenantes: Apprenante[]): Record<Groupe, number[]> {
  const sorted = [...apprenantes]
    .map((a) => ({ ...a, moy: moyenne(a) }))
    .sort((a, b) => (b.moy ?? 0) - (a.moy ?? 0))

  // Seuils de répartition par niveau
  const avancees    = sorted.filter((a) => (a.moy ?? 0) >= 15).map((a) => a.id)
  const intermediaires = sorted.filter((a) => (a.moy ?? 0) >= 11 && (a.moy ?? 0) < 15).map((a) => a.id)
  const debutants   = sorted.filter((a) => (a.moy ?? 0) < 11 || a.moy === null).map((a) => a.id)

  return { "Avancées": avancees, "Intermédiaires": intermediaires, "Débutants": debutants }
}

// ──────────────────────────────────────────────
// Onglet Planning
// ──────────────────────────────────────────────
function PlanningTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{ateliers.stats.cetteSemaine}</p>
          <p className="text-sm text-muted mt-1">Ateliers cette semaine</p>
        </div>
        <div className="bg-ateliers-light rounded-xl border border-ateliers/20 p-4">
          <p className="text-3xl font-bold text-ateliers-dark">{ateliers.stats.groupesAComposer}</p>
          <p className="text-sm text-ateliers-dark/70 mt-1">Groupes à composer</p>
        </div>
        <div className="bg-absences-light rounded-xl border border-absences/20 p-4">
          <p className="text-3xl font-bold text-absences-dark">{ateliers.stats.sallesNonConfirmees}</p>
          <p className="text-sm text-absences-dark/70 mt-1">Salle non confirmée</p>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm">Prochains ateliers</h2>
        </div>
        <ul className="divide-y divide-border">
          {ateliers.prochains.map((a) => (
            <li key={a.id} className="px-5 py-4 flex items-center gap-4">
              <div className="text-center w-14 shrink-0">
                <p className="text-xs text-muted">{new Date(a.date).toLocaleDateString("fr-FR", { weekday: "short" })}</p>
                <p className="text-lg font-bold text-foreground">{new Date(a.date).getDate()}</p>
                <p className="text-xs text-muted">{a.heure}</p>
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">{a.titre}</p>
                <p className="text-xs text-muted mt-0.5">{a.groupe} · {a.formatrice}</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {a.salle === "À confirmer" ? (
                  <span className="flex items-center gap-1 text-xs bg-absences-light text-absences-dark px-2.5 py-1 rounded-full">
                    <AlertTriangle size={11} /> {a.salle}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted"><MapPin size={11} /> {a.salle}</span>
                )}
                <span className="text-xs text-muted">{a.inscrits}/{a.places}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Onglet Notes apprenantes (éditable)
// ──────────────────────────────────────────────
function NotesTab() {
  const [apprenantes, setApprenantes] = useState<Apprenante[]>(() => loadApp())
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing, setEditing] = useState<Apprenante | null>(null)
  const [form, setForm] = useState<Partial<Apprenante>>({})

  function persist(data: Apprenante[]) { setApprenantes(data); localStorage.setItem(STORAGE_APP, JSON.stringify(data)) }

  function openEdit(a: Apprenante) { setEditing(a); setForm({ ...a }); setSlideOpen(true) }

  function handleSave() {
    if (!editing) return
    const val = (v: string) => v === "" ? null : Number(v)
    persist(apprenantes.map((x) => x.id === editing.id ? {
      ...x, ...form,
      noteLogique: val(String(form.noteLogique ?? "")),
      notePratique: val(String(form.notePratique ?? "")),
      noteProjet: val(String(form.noteProjet ?? "")),
      presences: Number(form.presences ?? x.presences),
      absences: Number(form.absences ?? x.absences),
    } : x))
    setSlideOpen(false)
  }

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold text-foreground text-sm">Notes & présences</h2>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-border">
          <tr>
            <th className="px-5 py-3 text-left text-xs font-medium text-muted">Apprenante</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted">Groupe</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-muted">Logique</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-muted">Pratique</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-muted">Projet</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-muted">Moy.</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-muted">Présences</th>
            <th className="px-2 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {apprenantes.map((a) => {
            const moy = moyenne(a)
            const { color } = niveauLabel(moy)
            return (
              <tr key={a.id} className="hover:bg-slate-50 group">
                <td className="px-5 py-3 font-medium text-foreground">{a.nom}</td>
                <td className="px-4 py-3 text-muted">{a.groupe}</td>
                <td className={`px-4 py-3 text-center ${noteColor(a.noteLogique)}`}>{a.noteLogique ?? "–"}</td>
                <td className={`px-4 py-3 text-center ${noteColor(a.notePratique)}`}>{a.notePratique ?? "–"}</td>
                <td className={`px-4 py-3 text-center ${noteColor(a.noteProjet)}`}>{a.noteProjet ?? "–"}</td>
                <td className="px-4 py-3 text-center">
                  {moy !== null ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{moy}/20</span> : <span className="text-muted">–</span>}
                </td>
                <td className="px-4 py-3 text-center text-xs">
                  <span className={a.absences >= 3 ? "text-alert font-semibold" : "text-muted"}>
                    {a.presences} séances · {a.absences} abs.
                  </span>
                </td>
                <td className="px-2 py-3">
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil size={13} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title={`Modifier — ${editing?.nom}`} subtitle="Notes & présences">
        <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="flex flex-col gap-4">
          <Field label="Groupe">
            <Select value={String(form.groupe ?? "")} onChange={e => setForm(f => ({ ...f, groupe: e.target.value }))}>
              <option>Débutants</option><option>Intermédiaires</option><option>Avancées</option>
            </Select>
          </Field>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Notes (/20)</p>
          <FormRow>
            <Field label="Logique">
              <Input type="number" min={0} max={20} placeholder="–" value={form.noteLogique !== null && form.noteLogique !== undefined ? String(form.noteLogique) : ""} onChange={e => setForm(f => ({ ...f, noteLogique: e.target.value === "" ? null : Number(e.target.value) }))} />
            </Field>
            <Field label="Pratique">
              <Input type="number" min={0} max={20} placeholder="–" value={form.notePratique !== null && form.notePratique !== undefined ? String(form.notePratique) : ""} onChange={e => setForm(f => ({ ...f, notePratique: e.target.value === "" ? null : Number(e.target.value) }))} />
            </Field>
          </FormRow>
          <Field label="Projet">
            <Input type="number" min={0} max={20} placeholder="–" value={form.noteProjet !== null && form.noteProjet !== undefined ? String(form.noteProjet) : ""} onChange={e => setForm(f => ({ ...f, noteProjet: e.target.value === "" ? null : Number(e.target.value) }))} />
          </Field>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Assiduité</p>
          <FormRow>
            <Field label="Séances présentes">
              <Input type="number" min={0} value={String(form.presences ?? 0)} onChange={e => setForm(f => ({ ...f, presences: Number(e.target.value) }))} />
            </Field>
            <Field label="Absences">
              <Input type="number" min={0} value={String(form.absences ?? 0)} onChange={e => setForm(f => ({ ...f, absences: Number(e.target.value) }))} />
            </Field>
          </FormRow>
          <SaveButton />
        </form>
      </SlideOver>
    </div>
  )
}

// ──────────────────────────────────────────────
// Onglet Composition des groupes (2.1)
// ──────────────────────────────────────────────
function ComposerTab() {
  const initial = useMemo(() => {
    const groups: Record<Groupe, number[]> = { "Débutants": [], "Intermédiaires": [], "Avancées": [] }
    ateliers.apprenantes.forEach((a) => {
      const g = a.groupe as Groupe
      if (GROUPES.includes(g)) groups[g].push(a.id)
    })
    return groups
  }, [])

  const [groupes, setGroupes] = useState<Record<Groupe, number[]>>(initial)
  const [selected, setSelected] = useState<number | null>(null)
  const [suggestion, setSuggestion] = useState(false)

  const displayGroups = suggestion ? autoBalance(ateliers.apprenantes) : groupes

  function moveToGroup(apprenanteId: number, targetGroup: Groupe) {
    setGroupes((prev) => {
      const updated: Record<Groupe, number[]> = { ...prev }
      GROUPES.forEach((g) => { updated[g] = updated[g].filter((id) => id !== apprenanteId) })
      updated[targetGroup] = [...updated[targetGroup], apprenanteId]
      return updated
    })
    setSelected(null)
    setSuggestion(false)
  }

  const unassigned = ateliers.apprenantes.filter((a) => !GROUPES.some((g) => displayGroups[g].includes(a.id)))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Cliquez sur une apprenante pour la sélectionner, puis choisissez son groupe. Les scores colorés reflètent la moyenne des notes.
        </p>
        <button
          onClick={() => { setSuggestion((v) => !v); setSelected(null) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
            suggestion
              ? "bg-ateliers text-white border-ateliers"
              : "bg-surface text-foreground border-border hover:bg-slate-50"
          }`}
        >
          <Shuffle size={14} />
          {suggestion ? "Vue suggérée active" : "Suggérer une répartition"}
        </button>
      </div>

      {suggestion && (
        <div className="bg-ateliers-light border border-ateliers/30 rounded-xl p-3 text-sm text-ateliers-dark flex items-center gap-2">
          <Shuffle size={14} />
          Répartition automatique basée sur la moyenne des notes — cliquez sur "Appliquer" pour confirmer.
          <button
            onClick={() => { setGroupes(displayGroups); setSuggestion(false) }}
            className="ml-auto text-xs font-semibold bg-ateliers text-white px-3 py-1 rounded-lg hover:bg-ateliers-dark"
          >
            Appliquer
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {GROUPES.map((groupe) => {
          const membres = displayGroups[groupe].map((id) => ateliers.apprenantes.find((a) => a.id === id)!).filter(Boolean)
          const moyennes = membres.map(moyenne).filter((m): m is number => m !== null)
          const moyGroupe = moyennes.length > 0 ? Math.round((moyennes.reduce((s, m) => s + m, 0) / moyennes.length) * 10) / 10 : null

          return (
            <div key={groupe} className={`rounded-xl border-2 p-4 ${selected !== null ? "border-dashed cursor-pointer hover:opacity-90 transition-opacity" : "border-transparent bg-slate-50"} ${GROUPE_COLORS[groupe].split(" ").slice(2).join(" ")}`}
              style={{ borderColor: selected !== null ? undefined : "transparent" }}
              onClick={() => selected !== null ? moveToGroup(selected, groupe) : undefined}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-semibold text-sm ${GROUPE_COLORS[groupe].split(" ")[2]}`}>{groupe}</h3>
                <div className="flex items-center gap-2">
                  {moyGroupe && <span className="text-xs text-muted">moy. {moyGroupe}</span>}
                  <span className="text-xs bg-white/70 rounded-full px-2 py-0.5 font-medium">{membres.length}</span>
                </div>
              </div>

              {selected !== null && (
                <div className={`text-xs text-center py-2 rounded-lg mb-2 ${GROUPE_COLORS[groupe]} border`}>
                  ↓ Déplacer ici
                </div>
              )}

              <div className="space-y-2">
                {membres.map((a) => {
                  const moy = moyenne(a)
                  const { color } = niveauLabel(moy)
                  const isSelected = selected === a.id
                  return (
                    <div
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); setSelected(isSelected ? null : a.id); setSuggestion(false) }}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                        isSelected ? "ring-2 ring-ateliers bg-white shadow-sm" : "bg-white/60 hover:bg-white"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-slate-500">{a.nom.split(" ").map((n) => n[0]).join("")}</span>
                      </div>
                      <span className="text-xs font-medium text-foreground flex-1">{a.nom}</span>
                      {moy !== null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{moy}</span>
                      )}
                    </div>
                  )
                })}
                {membres.length === 0 && (
                  <p className="text-xs text-center text-muted/60 italic py-3">Groupe vide</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selected !== null && (
        <p className="text-center text-sm text-ateliers-dark font-medium">
          {ateliers.apprenantes.find((a) => a.id === selected)?.nom} sélectionnée — cliquez sur un groupe pour la déplacer
        </p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Page principale
// ──────────────────────────────────────────────
const TABS = [
  { id: "planning", label: "Planning", icon: CalendarDays },
  { id: "notes",    label: "Notes & présences", icon: GraduationCap },
  { id: "groupes",  label: "Composer les groupes", icon: Users },
] as const

export default function AteliersPage() {
  const [tab, setTab] = useState<"planning" | "notes" | "groupes">("planning")

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Ateliers</h1>
        <p className="text-sm text-muted mt-1">Planning, notes et composition des groupes</p>
      </header>

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === id ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "planning" && <PlanningTab />}
      {tab === "notes"    && <NotesTab />}
      {tab === "groupes"  && <ComposerTab />}
    </div>
  )
}
