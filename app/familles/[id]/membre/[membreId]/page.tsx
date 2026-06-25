"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import { ChevronRight, Phone, Mail, MapPin, Users, UserCheck } from "lucide-react"
import {
  type BeneficiaireParent,
  type BeneficiaireEnfant,
  type Groupe,
  type Inscription,
  type Famille,
  getStatut,
} from "@/lib/familles-data"
import { fetchAllData, saveParent, saveEnfant, removeContact } from "@/lib/sheets-api"

// ──────────────────────────────────────────────
// Helpers styles
// ──────────────────────────────────────────────
const groupeStyle: Record<string, string> = {
  "Alpha":  "bg-slate-100 text-slate-600",
  "Pré-A1": "bg-absences-light text-absences-dark",
  "A1":     "bg-ateliers-light text-ateliers-dark",
  "A2":     "bg-finances-light text-finances-dark",
}

const inscriptionStyle: Record<string, string> = {
  "Payé":    "bg-finances-light text-finances-dark",
  "À payer": "bg-absences-light text-absences-dark",
  "Exonéré": "bg-slate-100 text-slate-600",
}

const statutStyle: Record<string, string> = {
  "Actif":        "bg-finances-light text-finances-dark",
  "À surveiller": "bg-ateliers-light text-ateliers-dark",
  "Abandon":      "bg-absences-light text-absences-dark",
}

function calculerAge(dateStr: string): number | null {
  const parts = dateStr.split("/")
  if (parts.length !== 3) return null
  const [day, month, year] = parts.map(Number)
  if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900 || year > 2100) return null
  const today = new Date()
  const naissance = new Date(year, month - 1, day)
  let age = today.getFullYear() - naissance.getFullYear()
  const m = today.getMonth() - naissance.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < naissance.getDate())) age--
  return age >= 0 ? age : null
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <p className="text-xs text-muted mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function FicheMembrePage({ params }: { params: Promise<{ id: string; membreId: string }> }) {
  const { id, membreId } = use(params)
  const router = useRouter()

  const [familles, setFamilles] = useState<Famille[]>([])
  const [parents,  setParents]  = useState<BeneficiaireParent[]>([])
  const [enfants,  setEnfants]  = useState<BeneficiaireEnfant[]>([])
  const [loading,  setLoading]  = useState(true)
  const [slideOpen, setSlideOpen] = useState(false)

  const loadData = useCallback(async () => {
    const data = await fetchAllData()
    setFamilles(data.familles)
    setParents(data.parents)
    setEnfants(data.enfants)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Détermine le type en cherchant dans les deux listes
  const parent = parents.find(p => p.id === membreId)
  const enfant = enfants.find(e => e.id === membreId)
  const isParent = !!parent
  const famille  = familles.find(f => f.id === id)
  const membre = parent ?? enfant

  // ── État du formulaire ────────────────────────
  const [form, setForm] = useState<BeneficiaireParent | BeneficiaireEnfant | null>(null)
  useEffect(() => { if (membre) setForm({ ...membre }) }, [membreId, parents, enfants])

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[300px]">
      <p className="text-muted text-sm">Chargement des données…</p>
    </div>
  )

  if (!membre || !famille || !form) {
    return (
      <div className="p-6">
        <p className="text-muted">Membre introuvable.</p>
        <Link href={`/familles/${id}`} className="text-familles-dark underline text-sm mt-2 inline-block">← Retour</Link>
      </div>
    )
  }

  const typeLabel = isParent ? "Parent" : "Enfant"
  const TypeIcon  = isParent ? Users : UserCheck

  // ── Sauvegarde ────────────────────────────────
  async function handleSave() {
    if (!form) return
    if (isParent) {
      await saveParent(form as BeneficiaireParent, false)
    } else {
      await saveEnfant(form as BeneficiaireEnfant, false)
    }
    await loadData()
    setSlideOpen(false)
  }

  // ── Suppression ───────────────────────────────
  async function handleDelete() {
    await removeContact(membreId)
    router.push(`/familles/${id}`)
  }

  const f = form as BeneficiaireParent & BeneficiaireEnfant

  // ──────────────────────────────────────────────
  // Rendu
  // ──────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-1.5 text-sm text-muted mb-5 flex-wrap">
        <Link href="/familles" className="hover:text-familles-dark transition-colors">Familles</Link>
        <ChevronRight size={14} />
        <Link href={`/familles/${id}`} className="hover:text-familles-dark transition-colors">{famille.nomFamille}</Link>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium">{membre.prenom} {membre.nom}</span>
      </nav>

      {/* En-tête */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              isParent ? "bg-ateliers-light text-ateliers-dark" : "bg-familles-light text-familles-dark"
            }`}>
              <TypeIcon size={11} />
              {typeLabel}
            </span>
            {membre.groupe && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${groupeStyle[membre.groupe] ?? "bg-slate-100 text-slate-600"}`}>
                {membre.groupe}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutStyle[getStatut(membre.assiduite)]}`}>
              {getStatut(membre.assiduite)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{membre.prenom} {membre.nom}</h1>
        </div>
        <button
          onClick={() => setSlideOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-familles-light text-familles-dark text-sm font-medium hover:bg-familles hover:text-white transition-colors shrink-0"
        >
          Modifier
        </button>
      </div>

      {/* Carte infos */}
      <div className="bg-surface border border-border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">

        {/* Contact */}
        <div className="flex items-start gap-2">
          <Phone size={15} className="text-muted mt-0.5 shrink-0" />
          <div className="space-y-1">
            <InfoRow label="Téléphone" value={membre.telephone} />
            {membre.whatsapp && membre.whatsapp !== membre.telephone && (
              <InfoRow label="WhatsApp" value={membre.whatsapp} />
            )}
          </div>
        </div>

        {membre.email && (
          <div className="flex items-start gap-2">
            <Mail size={15} className="text-muted mt-0.5 shrink-0" />
            <InfoRow label="Email" value={membre.email} />
          </div>
        )}

        <div className="flex items-start gap-2">
          <MapPin size={15} className="text-muted mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted mb-0.5">Adresse</p>
            <p className="text-sm font-medium">{membre.adresse || "—"}</p>
            {membre.codePostal && <p className="text-sm text-muted">{membre.codePostal} {membre.ville}</p>}
          </div>
        </div>

        <div className="space-y-3">
          <InfoRow label="Inscriptions" value={membre.inscriptions} />
          {!isParent && (enfant as BeneficiaireEnfant).autorisationParentale && (
            <InfoRow label="Autorisation parentale" value={(enfant as BeneficiaireEnfant).autorisationParentale} />
          )}
          <InfoRow label="Date de naissance" value={membre.dateNaissance} />
          <InfoRow label="Âge" value={membre.age != null ? `${membre.age} ans` : undefined} />
        </div>
      </div>

      {/* Résultats */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Résultats & assiduité</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-muted mb-1">Test 1</p>
            <p className="text-xl font-bold text-foreground">
              {membre.test1 !== null ? `${membre.test1}/20` : "—"}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-muted mb-1">Test 2</p>
            <p className="text-xl font-bold text-foreground">
              {membre.test2 !== null ? `${membre.test2}/20` : "—"}
            </p>
          </div>
          <div className="bg-familles-light rounded-lg p-3">
            <p className="text-xs text-familles-dark mb-1">Assiduité</p>
            <p className="text-xl font-bold text-familles-dark">{membre.assiduite}%</p>
          </div>
        </div>
      </div>

      {/* ── SlideOver modification ───────────────── */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={`Modifier — ${membre.prenom} ${membre.nom}`}
        subtitle={typeLabel}
        width="md"
      >
        <form onSubmit={e => { e.preventDefault(); handleSave() }} className="flex flex-col gap-4">
          <FormRow>
            <Field label="Nom" required>
              <Input value={f.nom} onChange={e => setForm(prev => prev && ({ ...prev, nom: e.target.value }))} />
            </Field>
            <Field label="Prénom" required>
              <Input value={f.prenom} onChange={e => setForm(prev => prev && ({ ...prev, prenom: e.target.value }))} />
            </Field>
          </FormRow>
          <Field label="Téléphone">
            <Input value={f.telephone} onChange={e => setForm(prev => prev && ({ ...prev, telephone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email} onChange={e => setForm(prev => prev && ({ ...prev, email: e.target.value }))} />
          </Field>
          <Field label="WhatsApp">
            <Input value={f.whatsapp} onChange={e => setForm(prev => prev && ({ ...prev, whatsapp: e.target.value }))} />
          </Field>
          <Field label="Adresse">
            <Input value={f.adresse} onChange={e => setForm(prev => prev && ({ ...prev, adresse: e.target.value }))} />
          </Field>
          <FormRow>
            <Field label="Code postal">
              <Input value={f.codePostal} onChange={e => setForm(prev => prev && ({ ...prev, codePostal: e.target.value }))} />
            </Field>
            <Field label="Ville">
              <Input value={f.ville} onChange={e => setForm(prev => prev && ({ ...prev, ville: e.target.value }))} />
            </Field>
          </FormRow>
          <Field label="Groupe">
            <Select value={f.groupe} onChange={e => setForm(prev => prev && ({ ...prev, groupe: e.target.value as Groupe }))}>
              <option value="">— Choisir —</option>
              <option value="Alpha">Alpha</option>
              <option value="Pré-A1">Pré-A1</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
            </Select>
          </Field>
          <Field label="Inscriptions">
            <Select value={f.inscriptions} onChange={e => setForm(prev => prev && ({ ...prev, inscriptions: e.target.value as Inscription }))}>
              <option value="">— Choisir —</option>
              <option value="Payé">Payé</option>
              <option value="À payer">À payer</option>
              <option value="Exonéré">Exonéré</option>
            </Select>
          </Field>
          <FormRow>
            <Field label="Date de naissance">
              <Input
                placeholder="JJ/MM/AAAA"
                value={f.dateNaissance ?? ""}
                onChange={e => {
                  const date = e.target.value
                  const age = calculerAge(date)
                  setForm(prev => prev && ({ ...prev, dateNaissance: date, ...(age !== null ? { age } : {}) }))
                }}
              />
            </Field>
            <Field label="Âge (auto)">
              <Input
                type="number" min={0} max={120}
                value={f.age ?? ""}
                onChange={e => setForm(prev => prev && ({ ...prev, age: e.target.value === "" ? null : Number(e.target.value) }))}
              />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Test 1 /20">
              <Input
                type="number" min={0} max={20}
                value={f.test1 ?? ""}
                onChange={e => setForm(prev => prev && ({ ...prev, test1: e.target.value === "" ? null : Number(e.target.value) }))}
              />
            </Field>
            <Field label="Test 2 /20">
              <Input
                type="number" min={0} max={20}
                value={f.test2 ?? ""}
                onChange={e => setForm(prev => prev && ({ ...prev, test2: e.target.value === "" ? null : Number(e.target.value) }))}
              />
            </Field>
          </FormRow>
          {!isParent && (
            <Field label="Autorisation parentale">
              <Select
                value={(f as BeneficiaireEnfant).autorisationParentale ?? ""}
                onChange={e => setForm(prev => prev && ({ ...prev, autorisationParentale: e.target.value as "OUI" | "NON" | "" }))}
              >
                <option value="">— Choisir —</option>
                <option value="OUI">OUI</option>
                <option value="NON">NON</option>
              </Select>
            </Field>
          )}
          <SaveButton />
          <DeleteButton onClick={handleDelete} />
        </form>
      </SlideOver>
    </div>
  )
}
