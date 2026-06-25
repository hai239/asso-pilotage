"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import { ChevronRight, Pencil, Plus, Phone, MapPin, Users, UserCheck } from "lucide-react"
import {
  type Famille,
  type BeneficiaireParent,
  type BeneficiaireEnfant,
  type Groupe,
  type Inscription,
  getStatut,
} from "@/lib/familles-data"
import { fetchAllData, saveFamille, removeFamille, saveParent, saveEnfant } from "@/lib/sheets-api"

// ──────────────────────────────────────────────
// Types locaux
// ──────────────────────────────────────────────
type MembreType = "parent" | "enfant"
type SlideMode  = "edit-famille" | "add-membre"

interface MembreForm {
  type: MembreType
  nom: string; prenom: string; telephone: string
  adresse: string; codePostal: string; ville: string
  email: string; whatsapp: string
  groupe: Groupe; inscriptions: Inscription
  autorisationParentale: "OUI" | "NON" | ""
  dateNaissance: string
  age: number | null
}

const emptyMembre = (famille: Famille): MembreForm => ({
  type: "parent",
  nom: "", prenom: "", telephone: "",
  adresse: famille.adresse, codePostal: famille.codePostal, ville: famille.ville,
  email: "", whatsapp: "",
  groupe: "", inscriptions: "",
  autorisationParentale: "",
  dateNaissance: "",
  age: null,
})

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

// ──────────────────────────────────────────────
// Helpers
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

function nextContactId(parents: BeneficiaireParent[], enfants: BeneficiaireEnfant[]): string {
  const ids = [...parents, ...enfants].map(c => parseInt(c.id.replace(/\D/g, "")) || 0)
  return `CONT${String(Math.max(0, ...ids) + 1).padStart(3, "0")}`
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function FicheFamillePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()

  const [familles, setFamilles] = useState<Famille[]>([])
  const [parents,  setParents]  = useState<BeneficiaireParent[]>([])
  const [enfants,  setEnfants]  = useState<BeneficiaireEnfant[]>([])
  const [loading,  setLoading]  = useState(true)

  const [slideOpen, setSlideOpen] = useState(false)
  const [slideMode, setSlideMode] = useState<SlideMode>("edit-famille")
  const [form,      setForm]      = useState<Famille | null>(null)
  const [membreForm, setMembreForm] = useState<MembreForm | null>(null)

  const loadData = useCallback(async () => {
    const data = await fetchAllData()
    setFamilles(data.familles)
    setParents(data.parents)
    setEnfants(data.enfants)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[300px]">
      <p className="text-muted text-sm">Chargement des données…</p>
    </div>
  )

  const famille = familles.find(f => f.id === id)

  // Membres liés
  const familleParents = parents.filter(p => p.idFamille === id)
  const familleEnfants = enfants.filter(e => e.idFamille === id)

  if (!famille) {
    return (
      <div className="p-6">
        <p className="text-muted">Famille introuvable.</p>
        <Link href="/familles" className="text-familles-dark underline text-sm mt-2 inline-block">← Retour</Link>
      </div>
    )
  }

  // ── Édition famille ──────────────────────────
  function openEdit() {
    setForm({ ...famille! })
    setSlideMode("edit-famille")
    setSlideOpen(true)
  }

  async function handleSaveFamille() {
    if (!form) return
    await saveFamille(form, false)
    // Cascade adresse → membres de la famille
    const membresAMettreAJour = [
      ...parents.filter(p => p.idFamille === form.id).map(p => saveParent({ ...p, adresse: form.adresse, codePostal: form.codePostal, ville: form.ville }, false)),
      ...enfants.filter(e => e.idFamille === form.id).map(e => saveEnfant({ ...e, adresse: form.adresse, codePostal: form.codePostal, ville: form.ville }, false)),
    ]
    await Promise.all(membresAMettreAJour)
    await loadData()
    setSlideOpen(false)
  }

  async function handleDeleteFamille() {
    await removeFamille(id)
    router.push("/familles")
  }

  // ── Ajout membre ─────────────────────────────
  function openAddMembre() {
    setMembreForm(emptyMembre(famille!))
    setSlideMode("add-membre")
    setSlideOpen(true)
  }

  async function handleSaveMembre() {
    if (!membreForm) return
    const newId = nextContactId(parents, enfants)
    if (membreForm.type === "parent") {
      const newParent: BeneficiaireParent = {
        id: newId, idFamille: id,
        nom: membreForm.nom, prenom: membreForm.prenom,
        telephone: membreForm.telephone,
        adresse: membreForm.adresse, codePostal: membreForm.codePostal, ville: membreForm.ville,
        email: membreForm.email, whatsapp: membreForm.whatsapp,
        groupe: membreForm.groupe, inscriptions: membreForm.inscriptions,
        test1: null, test2: null, assiduite: 0,
        dateNaissance: membreForm.dateNaissance,
        age: membreForm.age,
      }
      await saveParent(newParent, true)
    } else {
      const newEnfant: BeneficiaireEnfant = {
        id: newId, idFamille: id,
        nom: membreForm.nom, prenom: membreForm.prenom,
        telephone: membreForm.telephone,
        adresse: membreForm.adresse, codePostal: membreForm.codePostal, ville: membreForm.ville,
        email: membreForm.email, whatsapp: membreForm.whatsapp,
        groupe: membreForm.groupe, inscriptions: membreForm.inscriptions,
        autorisationParentale: membreForm.autorisationParentale,
        test1: null, test2: null, assiduite: 0,
        dateNaissance: membreForm.dateNaissance,
        age: membreForm.age,
      }
      await saveEnfant(newEnfant, true)
    }
    await loadData()
    setSlideOpen(false)
  }

  // ──────────────────────────────────────────────
  // Rendu
  // ──────────────────────────────────────────────
  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-1.5 text-sm text-muted mb-5">
        <Link href="/familles" className="hover:text-familles-dark transition-colors">Familles</Link>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium">{famille.nomFamille}</span>
      </nav>

      {/* En-tête */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-familles-dark">{famille.nomFamille}</h1>
          <p className="text-sm text-muted mt-0.5">{famille.contactPrincipal}</p>
        </div>
        <button
          onClick={openEdit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-familles-light text-familles-dark text-sm font-medium hover:bg-familles hover:text-white transition-colors"
        >
          <Pencil size={14} />
          Modifier
        </button>
      </div>

      {/* Carte infos famille */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <Phone size={15} className="text-muted mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted mb-0.5">Téléphone</p>
              <p className="font-medium">{famille.telephone || "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={15} className="text-muted mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted mb-0.5">Adresse</p>
              <p className="font-medium">{famille.adresse || "—"}</p>
              {famille.codePostal && <p className="text-muted">{famille.codePostal} {famille.ville}</p>}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted mb-1">Quartier QVP</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              famille.quartierQVP === "OUI" ? "bg-familles-light text-familles-dark" : "bg-slate-100 text-slate-500"
            }`}>
              {famille.quartierQVP}
            </span>
          </div>
          {famille.commentaires && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted mb-0.5">Commentaires</p>
              <p className="text-muted italic">{famille.commentaires}</p>
            </div>
          )}
        </div>
      </div>

      {/* Section Membres */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">
          Membres
          <span className="ml-2 text-xs font-normal text-muted">
            ({familleParents.length + familleEnfants.length})
          </span>
        </h2>
        <button
          onClick={openAddMembre}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-familles text-white text-sm font-medium hover:bg-familles-dark transition-colors"
        >
          <Plus size={14} />
          Ajouter un membre
        </button>
      </div>

      {familleParents.length === 0 && familleEnfants.length === 0 && (
        <p className="text-sm text-muted italic text-center py-8">Aucun membre enregistré pour cette famille.</p>
      )}

      {/* Parents */}
      {familleParents.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users size={12} /> Parents
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {familleParents.map(parent => (
              <Link
                key={parent.id}
                href={`/familles/${id}/membre/${parent.id}`}
                className="bg-surface border border-border rounded-lg p-4 hover:border-familles/40 hover:shadow-sm transition-all block"
              >
                <p className="font-semibold text-foreground">{parent.prenom} {parent.nom}</p>
                <p className="text-sm text-muted mt-0.5">{parent.telephone}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {parent.groupe && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${groupeStyle[parent.groupe] ?? "bg-slate-100 text-slate-600"}`}>
                      {parent.groupe}
                    </span>
                  )}
                  {parent.inscriptions && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inscriptionStyle[parent.inscriptions] ?? "bg-slate-100 text-slate-600"}`}>
                      {parent.inscriptions}
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-familles-light text-familles-dark">
                    {parent.assiduite}%
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutStyle[getStatut(parent.assiduite)]}`}>
                    {getStatut(parent.assiduite)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Enfants */}
      {familleEnfants.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <UserCheck size={12} /> Enfants
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {familleEnfants.map(enfant => (
              <Link
                key={enfant.id}
                href={`/familles/${id}/membre/${enfant.id}`}
                className="bg-surface border border-border rounded-lg p-4 hover:border-familles/40 hover:shadow-sm transition-all block"
              >
                <p className="font-semibold text-foreground">{enfant.prenom} {enfant.nom}</p>
                <p className="text-sm text-muted mt-0.5">{enfant.telephone}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {enfant.groupe && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${groupeStyle[enfant.groupe] ?? "bg-slate-100 text-slate-600"}`}>
                      {enfant.groupe}
                    </span>
                  )}
                  {enfant.autorisationParentale && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      enfant.autorisationParentale === "OUI" ? "bg-finances-light text-finances-dark" : "bg-absences-light text-absences-dark"
                    }`}>
                      Autorisation {enfant.autorisationParentale}
                    </span>
                  )}
                  {enfant.inscriptions && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inscriptionStyle[enfant.inscriptions] ?? "bg-slate-100 text-slate-600"}`}>
                      {enfant.inscriptions}
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-familles-light text-familles-dark">
                    {enfant.assiduite}%
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutStyle[getStatut(enfant.assiduite)]}`}>
                    {getStatut(enfant.assiduite)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── SlideOver édition famille ─────────── */}
      {form && (
        <SlideOver
          open={slideOpen && slideMode === "edit-famille"}
          onClose={() => setSlideOpen(false)}
          title="Modifier la famille"
          subtitle={form.nomFamille}
          width="md"
        >
          <form onSubmit={e => { e.preventDefault(); handleSaveFamille() }} className="flex flex-col gap-4">
            <Field label="Nom de famille" required>
              <Input value={form.nomFamille} onChange={e => setForm(f => f && ({ ...f, nomFamille: e.target.value }))} />
            </Field>
            <Field label="Contact principal">
              <Input value={form.contactPrincipal} onChange={e => setForm(f => f && ({ ...f, contactPrincipal: e.target.value }))} />
            </Field>
            <Field label="Téléphone">
              <Input value={form.telephone} onChange={e => setForm(f => f && ({ ...f, telephone: e.target.value }))} />
            </Field>
            <Field label="Adresse">
              <Input value={form.adresse} onChange={e => setForm(f => f && ({ ...f, adresse: e.target.value }))} />
            </Field>
            <FormRow>
              <Field label="Code postal">
                <Input value={form.codePostal} onChange={e => setForm(f => f && ({ ...f, codePostal: e.target.value }))} />
              </Field>
              <Field label="Ville">
                <Input value={form.ville} onChange={e => setForm(f => f && ({ ...f, ville: e.target.value }))} />
              </Field>
            </FormRow>
            <Field label="Quartier QVP">
              <Select value={form.quartierQVP} onChange={e => setForm(f => f && ({ ...f, quartierQVP: e.target.value as "OUI" | "NON" }))}>
                <option value="OUI">OUI</option>
                <option value="NON">NON</option>
              </Select>
            </Field>
            <Field label="Commentaires">
              <Textarea value={form.commentaires} onChange={e => setForm(f => f && ({ ...f, commentaires: e.target.value }))} rows={3} />
            </Field>
            <SaveButton />
            <DeleteButton onClick={handleDeleteFamille} />
          </form>
        </SlideOver>
      )}

      {/* ── SlideOver ajout membre ─────────────── */}
      {membreForm && (
        <SlideOver
          open={slideOpen && slideMode === "add-membre"}
          onClose={() => setSlideOpen(false)}
          title="Ajouter un membre"
          subtitle={`Famille ${famille.nomFamille}`}
          width="md"
        >
          <form onSubmit={e => { e.preventDefault(); handleSaveMembre() }} className="flex flex-col gap-4">
            <Field label="Type de bénéficiaire" required>
              <Select
                value={membreForm.type}
                onChange={e => setMembreForm(f => f && ({ ...f, type: e.target.value as MembreType }))}
              >
                <option value="parent">Parent</option>
                <option value="enfant">Enfant</option>
              </Select>
            </Field>
            <FormRow>
              <Field label="Nom" required>
                <Input value={membreForm.nom} onChange={e => setMembreForm(f => f && ({ ...f, nom: e.target.value }))} />
              </Field>
              <Field label="Prénom" required>
                <Input value={membreForm.prenom} onChange={e => setMembreForm(f => f && ({ ...f, prenom: e.target.value }))} />
              </Field>
            </FormRow>
            <Field label="Téléphone">
              <Input value={membreForm.telephone} onChange={e => setMembreForm(f => f && ({ ...f, telephone: e.target.value }))} />
            </Field>
            <Field label="Adresse">
              <Input value={membreForm.adresse} onChange={e => setMembreForm(f => f && ({ ...f, adresse: e.target.value }))} />
            </Field>
            <FormRow>
              <Field label="Code postal">
                <Input value={membreForm.codePostal} onChange={e => setMembreForm(f => f && ({ ...f, codePostal: e.target.value }))} />
              </Field>
              <Field label="Ville">
                <Input value={membreForm.ville} onChange={e => setMembreForm(f => f && ({ ...f, ville: e.target.value }))} />
              </Field>
            </FormRow>
            <Field label="Email">
              <Input type="email" value={membreForm.email} onChange={e => setMembreForm(f => f && ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="WhatsApp">
              <Input value={membreForm.whatsapp} onChange={e => setMembreForm(f => f && ({ ...f, whatsapp: e.target.value }))} />
            </Field>
            <FormRow>
              <Field label="Date de naissance">
                <Input
                  placeholder="JJ/MM/AAAA"
                  value={membreForm.dateNaissance}
                  onChange={e => {
                    const date = e.target.value
                    const age = calculerAge(date)
                    setMembreForm(f => f && ({ ...f, dateNaissance: date, ...(age !== null ? { age } : {}) }))
                  }}
                />
              </Field>
              <Field label="Âge (auto)">
                <Input
                  type="number" min={0} max={120}
                  value={membreForm.age ?? ""}
                  onChange={e => setMembreForm(f => f && ({ ...f, age: e.target.value === "" ? null : Number(e.target.value) }))}
                />
              </Field>
            </FormRow>
            <Field label="Groupe">
              <Select value={membreForm.groupe} onChange={e => setMembreForm(f => f && ({ ...f, groupe: e.target.value as Groupe }))}>
                <option value="">— Choisir —</option>
                <option value="Alpha">Alpha</option>
                <option value="Pré-A1">Pré-A1</option>
                <option value="A1">A1</option>
                <option value="A2">A2</option>
              </Select>
            </Field>
            <Field label="Inscriptions">
              <Select value={membreForm.inscriptions} onChange={e => setMembreForm(f => f && ({ ...f, inscriptions: e.target.value as Inscription }))}>
                <option value="">— Choisir —</option>
                <option value="Payé">Payé</option>
                <option value="À payer">À payer</option>
                <option value="Exonéré">Exonéré</option>
              </Select>
            </Field>
            {membreForm.type === "enfant" && (
              <Field label="Autorisation parentale">
                <Select
                  value={membreForm.autorisationParentale}
                  onChange={e => setMembreForm(f => f && ({ ...f, autorisationParentale: e.target.value as "OUI" | "NON" | "" }))}
                >
                  <option value="">— Choisir —</option>
                  <option value="OUI">OUI</option>
                  <option value="NON">NON</option>
                </Select>
              </Field>
            )}
            <SaveButton />
          </form>
        </SlideOver>
      )}
    </div>
  )
}
