"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Search, Users, UserCheck, Plus } from "lucide-react"
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton } from "@/components/SlideOver"
import {
  type Famille,
  type BeneficiaireParent,
  type BeneficiaireEnfant,
  type QVP,
  getStatut,
} from "@/lib/familles-data"
import { fetchAllData, saveFamille } from "@/lib/sheets-api"

type Onglet = "familles" | "parents" | "enfants"

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

const emptyFamille: Omit<Famille, "id"> = {
  nomFamille: "", contactPrincipal: "", telephone: "",
  adresse: "", codePostal: "", ville: "",
  quartierQVP: "NON", commentaires: "",
}

function nextFamilleId(familles: Famille[]): string {
  const ids = familles.map(f => parseInt(f.id.replace(/\D/g, "")) || 0)
  return `FAM${String(Math.max(0, ...ids) + 1).padStart(3, "0")}`
}

export default function FamillesPage() {
  const [onglet, setOnglet]    = useState<Onglet>("familles")
  const [familles, setFamilles] = useState<Famille[]>([])
  const [parents,  setParents]  = useState<BeneficiaireParent[]>([])
  const [enfants,  setEnfants]  = useState<BeneficiaireEnfant[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search, setSearch]     = useState("")
  const [slideOpen, setSlideOpen] = useState(false)
  const [form, setForm]           = useState<Omit<Famille, "id">>(emptyFamille)

  const loadData = useCallback(async () => {
    const data = await fetchAllData()
    setFamilles(data.familles)
    setParents(data.parents)
    setEnfants(data.enfants)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Réinitialise la recherche au changement d'onglet
  function switchOnglet(o: Onglet) { setOnglet(o); setSearch("") }

  async function handleSaveFamille() {
    const newFamille: Famille = { id: nextFamilleId(familles), ...form }
    await saveFamille(newFamille, true)
    await loadData()
    setForm(emptyFamille)
    setSlideOpen(false)
  }

  const filteredFamilles = familles
    .filter(f => f.nomFamille.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.nomFamille.localeCompare(b.nomFamille, "fr"))

  const filteredParents = parents
    .filter(p => `${p.prenom} ${p.nom}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"))

  const filteredEnfants = enfants
    .filter(e => `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"))

  const tabs: { key: Onglet; label: string; count: number }[] = [
    { key: "familles", label: "Familles",  count: familles.length },
    { key: "parents",  label: "Parents",   count: parents.length },
    { key: "enfants",  label: "Enfants",   count: enfants.length },
  ]

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[300px]">
      <p className="text-muted text-sm">Chargement des données…</p>
    </div>
  )

  const placeholder = onglet === "familles" ? "Rechercher par nom de famille…"
    : onglet === "parents" ? "Rechercher un parent…"
    : "Rechercher un enfant…"

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* En-tête */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-familles-dark">Bénéficiaires</h1>
          <p className="text-sm text-muted mt-0.5">Familles, parents et enfants suivis par l'association</p>
        </div>
        {onglet === "familles" && (
          <button
            onClick={() => { setForm(emptyFamille); setSlideOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-familles text-white text-sm font-medium hover:bg-familles-dark transition-colors shrink-0"
          >
            <Plus size={14} />
            Ajouter une famille
          </button>
        )}
      </div>

      {/* Onglets + recherche */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => switchOnglet(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                onglet === t.key
                  ? "bg-surface text-familles-dark shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                onglet === t.key ? "bg-familles-light text-familles-dark" : "bg-white text-muted"
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-familles/30 focus:border-familles"
          />
        </div>
      </div>

      {/* ── Onglet Familles ── */}
      {onglet === "familles" && (
        filteredFamilles.length === 0
          ? <p className="text-muted text-sm text-center mt-16">Aucune famille trouvée.</p>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFamilles.map(famille => {
                const nbParents = parents.filter(p => p.idFamille === famille.id).length
                const nbEnfants = enfants.filter(e => e.idFamille === famille.id).length
                return (
                  <Link
                    key={famille.id}
                    href={`/familles/${famille.id}`}
                    className="bg-surface border border-border rounded-xl p-5 hover:border-familles/40 hover:shadow-sm transition-all block"
                  >
                    <span className="text-lg font-bold text-familles-dark">{famille.nomFamille}</span>
                    <div className="mt-2 space-y-1 text-sm text-muted">
                      <p>{famille.contactPrincipal}</p>
                      <p>{famille.telephone}</p>
                      {famille.adresse && (
                        <p className="text-xs text-slate-400">{famille.adresse}, {famille.codePostal} {famille.ville}</p>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${famille.quartierQVP === "OUI" ? "bg-familles-light text-familles-dark" : "bg-slate-100 text-slate-500"}`}>
                        QVP {famille.quartierQVP}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        {nbParents > 0 && <span className="flex items-center gap-1"><Users size={12} />{nbParents} parent{nbParents > 1 ? "s" : ""}</span>}
                        {nbEnfants > 0 && <span className="flex items-center gap-1"><UserCheck size={12} />{nbEnfants} enfant{nbEnfants > 1 ? "s" : ""}</span>}
                        {nbParents === 0 && nbEnfants === 0 && <span className="italic">Aucun membre</span>}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )
      )}

      {/* ── Onglet Parents ── */}
      {onglet === "parents" && (
        filteredParents.length === 0
          ? <p className="text-muted text-sm text-center mt-16">Aucun parent trouvé.</p>
          : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-xs text-muted">{filteredParents.length} parent{filteredParents.length > 1 ? "s" : ""}</p>
              </div>
              <div className="px-5 py-2 flex items-center gap-4 bg-slate-50 border-b border-border text-xs font-semibold text-muted">
                <div className="w-9 shrink-0" />
                <span className="flex-1">Membre</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-16 text-center">Groupe</span>
                  <span className="w-20 text-center">Inscription</span>
                  <span className="w-16 text-center">Assiduité</span>
                  <span className="w-24 text-center">Statut</span>
                </div>
              </div>
              <ul className="divide-y divide-border">
                {filteredParents.map(parent => {
                  const famille = familles.find(f => f.id === parent.idFamille)
                  return (
                    <li key={parent.id}>
                      <Link
                        href={`/familles/${parent.idFamille}/membre/${parent.id}`}
                        className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors block"
                      >
                        <div className="w-9 h-9 rounded-full bg-ateliers-light flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-ateliers-dark">
                            {parent.prenom[0]}{parent.nom[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">{parent.prenom} {parent.nom}</p>
                          <p className="text-sm text-muted">{parent.telephone}</p>
                          {famille && <p className="text-xs text-slate-400">Famille {famille.nomFamille}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-16 flex justify-center">
                            {parent.groupe && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${groupeStyle[parent.groupe] ?? "bg-slate-100 text-slate-600"}`}>
                                {parent.groupe}
                              </span>
                            )}
                          </div>
                          <div className="w-20 flex justify-center">
                            {parent.inscriptions && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inscriptionStyle[parent.inscriptions] ?? "bg-slate-100 text-slate-600"}`}>
                                {parent.inscriptions}
                              </span>
                            )}
                          </div>
                          <div className="w-16 flex justify-center">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-familles-light text-familles-dark">
                              {parent.assiduite}%
                            </span>
                          </div>
                          <div className="w-24 flex justify-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutStyle[getStatut(parent.assiduite)]}`}>
                              {getStatut(parent.assiduite)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
      )}

      {/* ── Onglet Enfants ── */}
      {onglet === "enfants" && (
        filteredEnfants.length === 0
          ? <p className="text-muted text-sm text-center mt-16">Aucun enfant trouvé.</p>
          : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-xs text-muted">{filteredEnfants.length} enfant{filteredEnfants.length > 1 ? "s" : ""}</p>
              </div>
              <div className="px-5 py-2 flex items-center gap-4 bg-slate-50 border-b border-border text-xs font-semibold text-muted">
                <div className="w-9 shrink-0" />
                <span className="flex-1">Membre</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-16 text-center">Groupe</span>
                  <span className="w-20 text-center">Autorisation</span>
                  <span className="w-20 text-center">Inscription</span>
                  <span className="w-16 text-center">Assiduité</span>
                  <span className="w-24 text-center">Statut</span>
                </div>
              </div>
              <ul className="divide-y divide-border">
                {filteredEnfants.map(enfant => {
                  const famille = familles.find(f => f.id === enfant.idFamille)
                  return (
                    <li key={enfant.id}>
                      <Link
                        href={`/familles/${enfant.idFamille}/membre/${enfant.id}`}
                        className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors block"
                      >
                        <div className="w-9 h-9 rounded-full bg-familles-light flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-familles-dark">
                            {enfant.prenom[0]}{enfant.nom[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">{enfant.prenom} {enfant.nom}</p>
                          <p className="text-sm text-muted">{enfant.telephone}</p>
                          {famille && <p className="text-xs text-slate-400">Famille {famille.nomFamille}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-16 flex justify-center">
                            {enfant.groupe && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${groupeStyle[enfant.groupe] ?? "bg-slate-100 text-slate-600"}`}>
                                {enfant.groupe}
                              </span>
                            )}
                          </div>
                          <div className="w-20 flex justify-center">
                            {(enfant.autorisationParentale === "OUI" || enfant.autorisationParentale === "NON") && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${enfant.autorisationParentale === "OUI" ? "bg-finances-light text-finances-dark" : "bg-absences-light text-absences-dark"}`}>
                                Auth. {enfant.autorisationParentale}
                              </span>
                            )}
                          </div>
                          <div className="w-20 flex justify-center">
                            {enfant.inscriptions && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inscriptionStyle[enfant.inscriptions] ?? "bg-slate-100 text-slate-600"}`}>
                                {enfant.inscriptions}
                              </span>
                            )}
                          </div>
                          <div className="w-16 flex justify-center">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-familles-light text-familles-dark">
                              {enfant.assiduite}%
                            </span>
                          </div>
                          <div className="w-24 flex justify-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutStyle[getStatut(enfant.assiduite)]}`}>
                              {getStatut(enfant.assiduite)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
      )}

      {/* ── SlideOver nouvelle famille ── */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title="Ajouter une famille"
        width="md"
      >
        <form onSubmit={e => { e.preventDefault(); handleSaveFamille() }} className="flex flex-col gap-4">
          <Field label="Nom de famille" required>
            <Input value={form.nomFamille} onChange={e => setForm(f => ({ ...f, nomFamille: e.target.value }))} />
          </Field>
          <Field label="Contact principal">
            <Input value={form.contactPrincipal} onChange={e => setForm(f => ({ ...f, contactPrincipal: e.target.value }))} />
          </Field>
          <Field label="Téléphone">
            <Input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
          </Field>
          <Field label="Adresse">
            <Input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} />
          </Field>
          <FormRow>
            <Field label="Code postal">
              <Input value={form.codePostal} onChange={e => setForm(f => ({ ...f, codePostal: e.target.value }))} />
            </Field>
            <Field label="Ville">
              <Input value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} />
            </Field>
          </FormRow>
          <Field label="Quartier QVP">
            <Select value={form.quartierQVP} onChange={e => setForm(f => ({ ...f, quartierQVP: e.target.value as QVP }))}>
              <option value="OUI">OUI</option>
              <option value="NON">NON</option>
            </Select>
          </Field>
          <Field label="Commentaires">
            <Textarea value={form.commentaires} onChange={e => setForm(f => ({ ...f, commentaires: e.target.value }))} rows={3} />
          </Field>
          <SaveButton />
        </form>
      </SlideOver>
    </div>
  )
}
