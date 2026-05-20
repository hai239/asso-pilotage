"use client"

import { useState, useEffect } from "react"
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import { Plus, Pencil, Search, UserCheck, UserX, Users } from "lucide-react"
import { ROLE_LABELS, type Role } from "@/lib/auth"

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type StatutMembre = "active" | "inactive" | "en attente"

interface Membre {
  id: number
  prenom: string
  nom: string
  email: string
  telephone: string
  role: Role
  statut: StatutMembre
  dateInscription: string
  notes: string
}

const STORAGE_KEY = "asso-membres"

const MEMBRES_INITIAUX: Membre[] = [
  { id: 1,  prenom: "Nadjat",   nom: "B.",     email: "nadjat@asso.fr",   telephone: "06 11 22 33 44", role: "coordinatrice", statut: "active",     dateInscription: "2024-09-01", notes: "" },
  { id: 2,  prenom: "Somayeh",  nom: "M.",     email: "somayeh@asso.fr",  telephone: "06 22 33 44 55", role: "formatrice",    statut: "active",     dateInscription: "2024-09-01", notes: "Formatrice web & algorithmie" },
  { id: 3,  prenom: "Nadia",    nom: "A.",     email: "nadia@asso.fr",    telephone: "06 33 44 55 66", role: "formatrice",    statut: "active",     dateInscription: "2024-10-15", notes: "Formatrice projets avancées" },
  { id: 4,  prenom: "Amira",    nom: "L.",     email: "amira@asso.fr",    telephone: "06 44 55 66 77", role: "benevole",      statut: "active",     dateInscription: "2024-11-01", notes: "Accueil & animation" },
  { id: 5,  prenom: "Fatima",   nom: "K.",     email: "fatima@asso.fr",   telephone: "06 55 66 77 88", role: "benevole",      statut: "active",     dateInscription: "2025-01-10", notes: "" },
  { id: 6,  prenom: "Yasmine",  nom: "D.",     email: "yasmine@asso.fr",  telephone: "06 66 77 88 99", role: "benevole",      statut: "inactive",   dateInscription: "2024-12-01", notes: "Indisponible jusqu'à sept." },
  { id: 7,  prenom: "Inès",     nom: "C.",     email: "ines@asso.fr",     telephone: "",               role: "benevole",      statut: "en attente", dateInscription: "2025-05-10", notes: "Candidature reçue" },
]

const statutStyle: Record<StatutMembre, string> = {
  "active":     "bg-finances-light text-finances-dark",
  "inactive":   "bg-slate-100 text-muted",
  "en attente": "bg-absences-light text-absences-dark",
}

const roleStyle: Record<Role, string> = {
  admin:         "bg-communication-light text-communication-dark",
  coordinatrice: "bg-ateliers-light text-ateliers-dark",
  formatrice:    "bg-benevoles-light text-benevoles-dark",
  benevole:      "bg-slate-100 text-slate-600",
}

function load(fallback: Membre[]): Membre[] {
  if (typeof window === "undefined") return fallback
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : fallback } catch { return fallback }
}

const empty = (): Omit<Membre, "id"> => ({
  prenom: "", nom: "", email: "", telephone: "",
  role: "benevole", statut: "en attente",
  dateInscription: new Date().toISOString().split("T")[0],
  notes: "",
})

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function MembresPage() {
  const [membres, setMembres] = useState<Membre[]>(MEMBRES_INITIAUX)
  const [search, setSearch]   = useState("")
  const [filterRole, setFilterRole] = useState<Role | "tous">("tous")
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing,   setEditing]   = useState<Membre | null>(null)
  const [form,      setForm]      = useState<Omit<Membre, "id">>(empty())

  useEffect(() => { setMembres(load(MEMBRES_INITIAUX)) }, [])

  function persist(data: Membre[]) { setMembres(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }

  function openNew()       { setEditing(null); setForm(empty()); setSlideOpen(true) }
  function openEdit(m: Membre) { setEditing(m); setForm({ ...m }); setSlideOpen(true) }

  function handleSave() {
    const updated = editing
      ? membres.map((x) => x.id === editing.id ? { ...form, id: editing.id } : x)
      : [...membres, { ...form, id: Date.now() }]
    persist(updated); setSlideOpen(false)
  }

  function handleDelete() {
    if (!editing) return
    persist(membres.filter((x) => x.id !== editing.id))
    setSlideOpen(false)
  }

  // Stats
  const actifs    = membres.filter((m) => m.statut === "active").length
  const benevoles = membres.filter((m) => m.role === "benevole").length
  const enAttente = membres.filter((m) => m.statut === "en attente").length

  // Filtres
  const filtered = membres.filter((m) => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${m.prenom} ${m.nom} ${m.email}`.toLowerCase().includes(q)
    const matchRole = filterRole === "tous" || m.role === filterRole
    return matchSearch && matchRole
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Membres</h1>
          <p className="text-sm text-muted mt-1">Équipe, formatrices, bénévoles et coordinatrices</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors">
          <Plus size={14} /> Ajouter un membre
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-finances-light rounded-xl border border-finances/20 p-4">
          <p className="text-3xl font-bold text-finances-dark">{actifs}</p>
          <p className="text-sm text-finances-dark/70 mt-1">Membres actifs</p>
        </div>
        <div className="bg-benevoles-light rounded-xl border border-benevoles/20 p-4">
          <p className="text-3xl font-bold text-benevoles-dark">{benevoles}</p>
          <p className="text-sm text-benevoles-dark/70 mt-1">Bénévoles</p>
        </div>
        <div className={`rounded-xl border p-4 ${enAttente > 0 ? "bg-absences-light border-absences/20" : "bg-surface border-border"}`}>
          <p className={`text-3xl font-bold ${enAttente > 0 ? "text-absences-dark" : "text-foreground"}`}>{enAttente}</p>
          <p className={`text-sm mt-1 ${enAttente > 0 ? "text-absences-dark/70" : "text-muted"}`}>En attente de validation</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un membre…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-ateliers/30 focus:border-ateliers"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {(["tous", "admin", "coordinatrice", "formatrice", "benevole"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterRole === r ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
            >
              {r === "tous" ? "Tous" : ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2"><Users size={14} /> {filtered.length} membre{filtered.length > 1 ? "s" : ""}</h2>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted py-8 italic">Aucun membre trouvé</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((m) => (
              <li key={m.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 group">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-xs font-bold text-slate-500">
                  {m.prenom[0]}{m.nom[0]}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{m.prenom} {m.nom}</p>
                  <p className="text-xs text-muted mt-0.5 truncate">{m.email}{m.telephone ? ` · ${m.telephone}` : ""}</p>
                  {m.notes && <p className="text-xs text-slate-400 italic mt-0.5 truncate">{m.notes}</p>}
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleStyle[m.role]}`}>{ROLE_LABELS[m.role]}</span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statutStyle[m.statut]}`}>{m.statut}</span>
                  {m.statut === "active" ? <UserCheck size={13} className="text-finances-dark" /> : <UserX size={13} className="text-muted" />}
                  <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* SlideOver */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editing ? `Modifier — ${editing.prenom} ${editing.nom}` : "Nouveau membre"}
        subtitle="Informations & rôle"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="flex flex-col gap-4">
          <FormRow>
            <Field label="Prénom" required>
              <Input placeholder="Nadjat" value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
            </Field>
            <Field label="Nom" required>
              <Input placeholder="B." value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </Field>
          </FormRow>
          <Field label="Email" required>
            <Input type="email" placeholder="nadjat@asso.fr" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Téléphone">
            <Input placeholder="06 12 34 56 78" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
          </Field>
          <FormRow>
            <Field label="Rôle">
              <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
                {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
                  <option key={r} value={r}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Statut">
              <Select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as StatutMembre }))}>
                <option>active</option>
                <option>inactive</option>
                <option>en attente</option>
              </Select>
            </Field>
          </FormRow>
          <Field label="Date d'inscription">
            <Input type="date" value={form.dateInscription} onChange={e => setForm(f => ({ ...f, dateInscription: e.target.value }))} />
          </Field>
          <Field label="Notes">
            <Textarea placeholder="Compétences, disponibilités, commentaire…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
          <SaveButton />
          {editing && <DeleteButton onClick={handleDelete} />}
        </form>
      </SlideOver>
    </div>
  )
}
