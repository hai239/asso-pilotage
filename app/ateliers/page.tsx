"use client"

import { useState, useEffect } from "react"
import { ateliers as ateliersMock, benevoles as benevolesMock } from "@/lib/mock-data"
import Link from "next/link"
import { Plus, Pencil, CalendarDays, Users, UserCheck, ClipboardCheck } from "lucide-react"
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type SessionStatut = "planifié" | "en cours" | "terminé" | "annulé"
type NiveauBenef = "débutant" | "intermédiaire" | "avancé"
type StatutBenef = "actif" | "diplômé" | "abandon"
interface Session {
  id: number
  titre: string
  description: string
  date: string
  heure: string
  duree: string
  salle: string
  formatrice: string
  beneficiaireIds: number[]
  benevoleIds: number[]
  statut: SessionStatut
}

interface Beneficiaire {
  id: number
  prenom: string
  nom: string
  email: string
  telephone: string
  dateInscription: string
  niveau: NiveauBenef
  notes: string
  statut: StatutBenef
}

// ──────────────────────────────────────────────
// Storage
// ──────────────────────────────────────────────
const S_SESSIONS  = "asso-ateliers-sessions"
const S_BENEF     = "asso-beneficiaires"
const S_PRESENCES = (id: number) => `asso-presences-atelier-${id}`

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}

// ──────────────────────────────────────────────
// Helpers visuels
// ──────────────────────────────────────────────
const statutSessionStyle: Record<SessionStatut, string> = {
  "planifié":  "bg-ateliers-light text-ateliers-dark",
  "en cours":  "bg-absences-light text-absences-dark",
  "terminé":   "bg-finances-light text-finances-dark",
  "annulé":    "bg-slate-100 text-slate-500",
}

const niveauStyle: Record<NiveauBenef, string> = {
  "débutant":      "bg-absences-light text-absences-dark",
  "intermédiaire": "bg-ateliers-light text-ateliers-dark",
  "avancé":        "bg-finances-light text-finances-dark",
}

const emptySession = (): Omit<Session, "id"> => ({
  titre: "", description: "", date: new Date().toISOString().split("T")[0],
  heure: "14h00", duree: "2h", salle: "", formatrice: "",
  beneficiaireIds: [], benevoleIds: [], statut: "planifié",
})

const emptyBenef = (): Omit<Beneficiaire, "id"> => ({
  prenom: "", nom: "", email: "", telephone: "",
  dateInscription: new Date().toISOString().split("T")[0],
  niveau: "débutant", notes: "", statut: "actif",
})

// ──────────────────────────────────────────────
// Onglet Ateliers (CRUD sessions)
// ──────────────────────────────────────────────
function AteliersTab({
  sessions, beneficiaires, benevoles,
  onEdit,
}: {
  sessions: Session[]
  beneficiaires: Beneficiaire[]
  benevoles: typeof benevolesMock.liste
  onEdit: (s: Session) => void
}) {
  const sorted = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const upcoming = sorted.filter(s => s.statut !== "terminé" && s.statut !== "annulé")
  const past = sorted.filter(s => s.statut === "terminé" || s.statut === "annulé")

  function SessionCard({ s }: { s: Session }) {
    const benefs = s.beneficiaireIds.map(id => beneficiaires.find(b => b.id === id)).filter(Boolean) as Beneficiaire[]
    const bvls = s.benevoleIds.map(id => benevoles.find(b => b.id === id)).filter(Boolean) as (typeof benevoles)[0][]
    return (
      <li className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50 group">
        <div className="text-center w-14 shrink-0">
          <p className="text-xs text-muted">{new Date(s.date).toLocaleDateString("fr-FR", { weekday: "short" })}</p>
          <p className="text-lg font-bold text-foreground">{new Date(s.date).getDate()}</p>
          <p className="text-xs text-muted">{s.heure}</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-foreground text-sm">{s.titre}</p>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statutSessionStyle[s.statut]}`}>{s.statut}</span>
          </div>
          {s.description && <p className="text-xs text-muted mt-0.5 truncate">{s.description}</p>}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs text-muted">🕐 {s.duree}</span>
            {s.salle && <span className="text-xs text-muted">📍 {s.salle}</span>}
            {s.formatrice && <span className="text-xs text-muted">👩‍🏫 {s.formatrice}</span>}
          </div>
          <div className="flex items-center gap-4 mt-2">
            {benefs.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Users size={11} className="text-ateliers-dark" />
                <div className="flex gap-1 flex-wrap">
                  {benefs.map(b => (
                    <span key={b.id} className="text-[10px] bg-ateliers-light text-ateliers-dark px-1.5 py-0.5 rounded-full">{b.prenom} {b.nom}</span>
                  ))}
                </div>
              </div>
            )}
            {bvls.length > 0 && (
              <div className="flex items-center gap-1.5">
                <UserCheck size={11} className="text-benevoles-dark" />
                <div className="flex gap-1 flex-wrap">
                  {bvls.map(bv => (
                    <span key={bv.id} className="text-[10px] bg-benevoles-light text-benevoles-dark px-1.5 py-0.5 rounded-full">{bv.nom}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {s.statut !== "terminé" && s.statut !== "annulé" && (
            <Link
              href="/emargement"
              onClick={() => localStorage.setItem("asso-emargement-session", String(s.id))}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-ateliers-light text-ateliers-dark hover:opacity-80 transition-opacity"
            >
              <ClipboardCheck size={11} /> Émarger
            </Link>
          )}
          <button onClick={() => onEdit(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted">
            <Pencil size={13} />
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <section className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">À venir</h2>
          </div>
          <ul className="divide-y divide-border">
            {upcoming.map(s => <SessionCard key={s.id} s={s} />)}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm text-muted">Passés</h2>
          </div>
          <ul className="divide-y divide-border">
            {past.map(s => <SessionCard key={s.id} s={s} />)}
          </ul>
        </section>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Onglet Bénéficiaires
// ──────────────────────────────────────────────
function BeneficiairesTab({
  beneficiaires, sessions, onEdit,
}: {
  beneficiaires: Beneficiaire[]
  sessions: Session[]
  onEdit: (b: Beneficiaire) => void
}) {
  function getSessionCount(id: number) { return sessions.filter(s => s.beneficiaireIds.includes(id)).length }

  return (
    <section className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h2 className="font-semibold text-foreground text-sm">{beneficiaires.length} bénéficiaire{beneficiaires.length > 1 ? "s" : ""}</h2>
      </div>
      {beneficiaires.length === 0 ? (
        <p className="text-center text-sm text-muted py-8 italic">Aucun bénéficiaire</p>
      ) : (
        <ul className="divide-y divide-border">
          {beneficiaires.map(b => (
            <li key={b.id} className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50 group">
              <div className="w-9 h-9 rounded-full bg-ateliers-light flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-ateliers-dark">{b.prenom[0]}{b.nom[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{b.prenom} {b.nom}</p>
                <p className="text-xs text-muted mt-0.5">{b.email}{b.telephone ? ` · ${b.telephone}` : ""}</p>
                {b.notes && <p className="text-xs text-slate-400 italic mt-1 line-clamp-2">{b.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${niveauStyle[b.niveau]}`}>{b.niveau}</span>
                <span className="text-xs text-muted">{getSessionCount(b.id)} atelier{getSessionCount(b.id) > 1 ? "s" : ""}</span>
                {b.statut !== "actif" && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{b.statut}</span>}
                <button onClick={() => onEdit(b)} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                  <Pencil size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ──────────────────────────────────────────────
// Page principale
// ──────────────────────────────────────────────
const TABS = [
  { id: "ateliers",      label: "Ateliers",       icon: CalendarDays },
  { id: "beneficiaires", label: "Bénéficiaires",   icon: Users },
] as const

type TabId = (typeof TABS)[number]["id"]

export default function AteliersPage() {
  const [tab, setTab] = useState<TabId>("ateliers")

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>(ateliersMock.sessions as Session[])
  const [sessionSlide, setSessionSlide] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [sessionForm, setSessionForm] = useState<Omit<Session, "id">>(emptySession())

  // Bénéficiaires state
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>(ateliersMock.beneficiaires as Beneficiaire[])
  const [benefSlide, setBenefSlide] = useState(false)
  const [editingBenef, setEditingBenef] = useState<Beneficiaire | null>(null)
  const [benefForm, setBenefForm] = useState<Omit<Beneficiaire, "id">>(emptyBenef())

  // Bénévoles (lecture seule depuis mock)
  const benevoles = benevolesMock.liste

  useEffect(() => {
    setSessions(load(S_SESSIONS, ateliersMock.sessions as Session[]))
    setBeneficiaires(load(S_BENEF, ateliersMock.beneficiaires as Beneficiaire[]))
  }, [])

  // Sessions CRUD
  function persistSessions(data: Session[]) { setSessions(data); localStorage.setItem(S_SESSIONS, JSON.stringify(data)) }
  function openNewSession() { setEditingSession(null); setSessionForm(emptySession()); setSessionSlide(true) }
  function openEditSession(s: Session) { setEditingSession(s); setSessionForm({ ...s, beneficiaireIds: [...s.beneficiaireIds], benevoleIds: [...s.benevoleIds] }); setSessionSlide(true) }
  function handleSaveSession() {
    const updated = editingSession
      ? sessions.map(x => x.id === editingSession.id ? { ...sessionForm, id: editingSession.id } : x)
      : [...sessions, { ...sessionForm, id: Date.now() }]
    persistSessions(updated); setSessionSlide(false)
  }
  function handleDeleteSession() {
    if (!editingSession) return
    persistSessions(sessions.filter(x => x.id !== editingSession.id))
    setSessionSlide(false)
  }
  function toggleBenefInSession(id: number) {
    setSessionForm(f => ({
      ...f,
      beneficiaireIds: f.beneficiaireIds.includes(id) ? f.beneficiaireIds.filter(x => x !== id) : [...f.beneficiaireIds, id],
    }))
  }
  function toggleBenevoleInSession(id: number) {
    setSessionForm(f => ({
      ...f,
      benevoleIds: f.benevoleIds.includes(id) ? f.benevoleIds.filter(x => x !== id) : [...f.benevoleIds, id],
    }))
  }

  // Bénéficiaires CRUD
  function persistBenef(data: Beneficiaire[]) { setBeneficiaires(data); localStorage.setItem(S_BENEF, JSON.stringify(data)) }
  function openNewBenef() { setEditingBenef(null); setBenefForm(emptyBenef()); setBenefSlide(true) }
  function openEditBenef(b: Beneficiaire) { setEditingBenef(b); setBenefForm({ ...b }); setBenefSlide(true) }
  function handleSaveBenef() {
    const updated = editingBenef
      ? beneficiaires.map(x => x.id === editingBenef.id ? { ...benefForm, id: editingBenef.id } : x)
      : [...beneficiaires, { ...benefForm, id: Date.now() }]
    persistBenef(updated); setBenefSlide(false)
  }
  function handleDeleteBenef() {
    if (!editingBenef) return
    persistBenef(beneficiaires.filter(x => x.id !== editingBenef.id))
    setBenefSlide(false)
  }

  const aVenir = sessions.filter(s => s.statut === "planifié" || s.statut === "en cours").length

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ateliers</h1>
          <p className="text-sm text-muted mt-1">Gestion des sessions, présences et bénéficiaires</p>
        </div>
        <div className="flex gap-2">
          {tab === "ateliers" && (
            <button onClick={openNewSession} className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors">
              <Plus size={14} /> Nouvel atelier
            </button>
          )}
          {tab === "beneficiaires" && (
            <button onClick={openNewBenef} className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors">
              <Plus size={14} /> Nouveau bénéficiaire
            </button>
          )}
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-ateliers-light rounded-xl border border-ateliers/20 p-4">
          <p className="text-3xl font-bold text-ateliers-dark">{aVenir}</p>
          <p className="text-sm text-ateliers-dark/70 mt-1">Ateliers à venir</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{beneficiaires.filter(b => b.statut === "actif").length}</p>
          <p className="text-sm text-muted mt-1">Bénéficiaires actifs</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{sessions.filter(s => s.statut === "terminé").length}</p>
          <p className="text-sm text-muted mt-1">Sessions réalisées</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === id ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "ateliers"      && <AteliersTab sessions={sessions} beneficiaires={beneficiaires} benevoles={benevoles} onEdit={openEditSession} />}
      {tab === "beneficiaires" && <BeneficiairesTab beneficiaires={beneficiaires} sessions={sessions} onEdit={openEditBenef} />}

      {/* SlideOver — Atelier */}
      <SlideOver open={sessionSlide} onClose={() => setSessionSlide(false)}
        title={editingSession ? "Modifier l'atelier" : "Nouvel atelier"}
        width="lg"
      >
        <form onSubmit={e => { e.preventDefault(); handleSaveSession() }} className="flex flex-col gap-4">
          <Field label="Titre" required>
            <Input placeholder="Ex: Initiation HTML/CSS" value={sessionForm.titre} onChange={e => setSessionForm(f => ({ ...f, titre: e.target.value }))} />
          </Field>
          <Field label="Description">
            <Textarea placeholder="Objectifs, contenu…" value={sessionForm.description} onChange={e => setSessionForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <FormRow>
            <Field label="Date">
              <Input type="date" value={sessionForm.date} onChange={e => setSessionForm(f => ({ ...f, date: e.target.value }))} />
            </Field>
            <Field label="Heure">
              <Input placeholder="14h00" value={sessionForm.heure} onChange={e => setSessionForm(f => ({ ...f, heure: e.target.value }))} />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Durée">
              <Input placeholder="2h" value={sessionForm.duree} onChange={e => setSessionForm(f => ({ ...f, duree: e.target.value }))} />
            </Field>
            <Field label="Salle">
              <Input placeholder="Salle A" value={sessionForm.salle} onChange={e => setSessionForm(f => ({ ...f, salle: e.target.value }))} />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Formatrice">
              <Input placeholder="Somayeh" value={sessionForm.formatrice} onChange={e => setSessionForm(f => ({ ...f, formatrice: e.target.value }))} />
            </Field>
            <Field label="Statut">
              <Select value={sessionForm.statut} onChange={e => setSessionForm(f => ({ ...f, statut: e.target.value as SessionStatut }))}>
                <option>planifié</option><option>en cours</option><option>terminé</option><option>annulé</option>
              </Select>
            </Field>
          </FormRow>

          {/* Bénéficiaires multi-select */}
          <Field label="Bénéficiaires">
            <div className="flex flex-wrap gap-2">
              {beneficiaires.map(b => {
                const sel = sessionForm.beneficiaireIds.includes(b.id)
                return (
                  <button type="button" key={b.id} onClick={() => toggleBenefInSession(b.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${sel ? "bg-ateliers text-white border-ateliers" : "bg-surface text-muted border-border hover:border-ateliers"}`}
                  >
                    {b.prenom} {b.nom}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* Bénévoles multi-select */}
          <Field label="Bénévoles">
            <div className="flex flex-wrap gap-2">
              {benevoles.map(bv => {
                const sel = sessionForm.benevoleIds.includes(bv.id)
                return (
                  <button type="button" key={bv.id} onClick={() => toggleBenevoleInSession(bv.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${sel ? "bg-benevoles text-white border-benevoles" : "bg-surface text-muted border-border hover:border-benevoles"}`}
                  >
                    {bv.nom}
                  </button>
                )
              })}
            </div>
          </Field>

          <SaveButton />
          {editingSession && <DeleteButton onClick={handleDeleteSession} />}
        </form>
      </SlideOver>

      {/* SlideOver — Bénéficiaire */}
      <SlideOver open={benefSlide} onClose={() => setBenefSlide(false)}
        title={editingBenef ? `${editingBenef.prenom} ${editingBenef.nom}` : "Nouveau bénéficiaire"}
        subtitle="Fiche d'inscription"
        width="lg"
      >
        <form onSubmit={e => { e.preventDefault(); handleSaveBenef() }} className="flex flex-col gap-4">
          <FormRow>
            <Field label="Prénom" required>
              <Input placeholder="Leila" value={benefForm.prenom} onChange={e => setBenefForm(f => ({ ...f, prenom: e.target.value }))} />
            </Field>
            <Field label="Nom" required>
              <Input placeholder="A." value={benefForm.nom} onChange={e => setBenefForm(f => ({ ...f, nom: e.target.value }))} />
            </Field>
          </FormRow>
          <Field label="Email">
            <Input type="email" placeholder="leila@email.fr" value={benefForm.email} onChange={e => setBenefForm(f => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Téléphone">
            <Input placeholder="06 12 34 56 78" value={benefForm.telephone} onChange={e => setBenefForm(f => ({ ...f, telephone: e.target.value }))} />
          </Field>
          <FormRow>
            <Field label="Date d'inscription">
              <Input type="date" value={benefForm.dateInscription} onChange={e => setBenefForm(f => ({ ...f, dateInscription: e.target.value }))} />
            </Field>
            <Field label="Niveau à l'inscription">
              <Select value={benefForm.niveau} onChange={e => setBenefForm(f => ({ ...f, niveau: e.target.value as NiveauBenef }))}>
                <option value="débutant">Débutant</option>
                <option value="intermédiaire">Intermédiaire</option>
                <option value="avancé">Avancé</option>
              </Select>
            </Field>
          </FormRow>
          <Field label="Statut">
            <Select value={benefForm.statut} onChange={e => setBenefForm(f => ({ ...f, statut: e.target.value as StatutBenef }))}>
              <option value="actif">Actif</option>
              <option value="diplômé">Diplômé</option>
              <option value="abandon">Abandon</option>
            </Select>
          </Field>
          <Field label="Notes d'inscription">
            <Textarea rows={4} placeholder="Niveau, objectifs, besoins particuliers, contexte de vie…" value={benefForm.notes} onChange={e => setBenefForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
          <SaveButton />
          {editingBenef && <DeleteButton onClick={handleDeleteBenef} />}
        </form>
      </SlideOver>
    </div>
  )
}
