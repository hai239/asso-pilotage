"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { ChevronRight, Plus, GraduationCap, Users, Phone, X } from "lucide-react"
import SlideOver, { Field, Input, FormRow, SaveButton } from "@/components/SlideOver"
import {
  fetchEtablissementDetail, addProfesseur, deleteProfesseur,
  type EtablissementDetailSheet, type EleveEtablissement, type ProfesseurItem,
} from "@/lib/sheets-api"

const niveauStyle: Record<string, string> = {
  "Alpha":   "bg-slate-100 text-slate-600",
  "A1-":     "bg-absences-light text-absences-dark",
  "A1+":     "bg-absences-light text-absences-dark",
  "A2-":     "bg-ateliers-light text-ateliers-dark",
  "A2+/B1":  "bg-finances-light text-finances-dark",
}

const emptyProfForm = { Nom: "", Telephone: "", Email: "" }

export default function EtablissementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [etab, setEtab]           = useState<EtablissementDetailSheet | null>(null)
  const [loading, setLoading]     = useState(true)
  const [slideOpen, setSlideOpen] = useState(false)
  const [profForm, setProfForm]   = useState(emptyProfForm)
  const [saving, setSaving]       = useState(false)

  async function loadData() {
    try {
      const data = await fetchEtablissementDetail(id)
      setEtab(data)
    } catch { console.error("[etablissement] échec du chargement") }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [id])

  async function handleDeleteProfesseur(idProf: string, nom: string) {
    if (!confirm(`Supprimer le professeur "${nom}" ? Cette action est irréversible et retirera sa référence dans la scolarité des élèves associés.`)) return
    await deleteProfesseur(idProf)
    await loadData()
  }

  async function handleAddProfesseur() {
    if (saving || !profForm.Nom.trim()) return
    setSaving(true)
    try {
      await addProfesseur({ ...profForm, Etablissement_ID: id })
      setProfForm(emptyProfForm)
      setSlideOpen(false)
      await loadData()
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[300px]">
      <p className="text-muted text-sm">Chargement…</p>
    </div>
  )

  if (!etab) return (
    <div className="p-6">
      <p className="text-muted">Établissement introuvable.</p>
      <Link href="/familles" className="text-familles-dark underline text-sm mt-2 inline-block">← Retour</Link>
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-1.5 text-sm text-muted mb-5">
        <Link href="/familles" className="hover:text-familles-dark transition-colors">Familles</Link>
        <ChevronRight size={14} />
        <Link href="/familles" className="hover:text-familles-dark transition-colors">Établissements</Link>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium">{etab.Nom}</span>
      </nav>

      {/* En-tête */}
      <div className="mb-8">
        <p className="text-xs font-medium text-familles-dark uppercase tracking-wide mb-1">{etab.Type}</p>
        <h1 className="text-2xl font-bold text-foreground">{etab.Nom}</h1>
      </div>

      {/* ── Élèves inscrits ── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap size={16} className="text-familles-dark" />
          <h2 className="text-base font-semibold text-foreground">
            Élèves inscrits
            <span className="ml-2 text-xs font-normal text-muted">({etab.eleves.length})</span>
          </h2>
        </div>

        {etab.eleves.length === 0
          ? <p className="text-sm text-muted italic">Aucun élève inscrit dans cet établissement.</p>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {etab.eleves.map((eleve: EleveEtablissement) => (
                <Link
                  key={eleve.ID_Membre}
                  href={`/familles/${eleve.ID_Famille}/membre/${eleve.ID_Membre}`}
                  className="bg-surface border border-border rounded-xl p-4 hover:border-familles/40 hover:shadow-sm transition-all block"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-foreground">{eleve.Prenom} {eleve.Nom}</p>
                    {eleve.Niveau && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${niveauStyle[eleve.Niveau] ?? "bg-slate-100 text-slate-600"}`}>
                        {eleve.Niveau}
                      </span>
                    )}
                  </div>
                  {eleve.ProfPrincipal ? (
                    <div className="text-xs text-muted space-y-0.5">
                      <p className="font-medium text-foreground">{eleve.ProfPrincipal.Nom}</p>
                      {eleve.ProfPrincipal.Telephone && (
                        <p className="flex items-center gap-1"><Phone size={11} />{eleve.ProfPrincipal.Telephone}</p>
                      )}
                      {eleve.ProfPrincipal.Email && (
                        <p className="truncate">{eleve.ProfPrincipal.Email}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted italic">Aucun professeur associé</p>
                  )}
                </Link>
              ))}
            </div>
          )
        }
      </section>

      {/* ── Professeurs ── */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-familles-dark" />
            <h2 className="text-base font-semibold text-foreground">
              Professeurs
              <span className="ml-2 text-xs font-normal text-muted">({etab.professeurs.length})</span>
            </h2>
          </div>
          <button
            onClick={() => { setProfForm(emptyProfForm); setSlideOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-familles text-white text-sm font-medium hover:bg-familles-dark transition-colors"
          >
            <Plus size={13} />
            Ajouter
          </button>
        </div>

        {etab.professeurs.length === 0
          ? <p className="text-sm text-muted italic">Aucun professeur enregistré pour cet établissement.</p>
          : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <ul className="divide-y divide-border">
                {etab.professeurs.map((prof: ProfesseurItem) => (
                  <li key={prof.ID} className="flex items-center">
                    <div className="flex-1 px-5 py-4 flex items-center justify-between gap-4">
                      <span className="font-semibold text-foreground">{prof.Nom}</span>
                      <div className="flex items-center gap-4 text-xs text-muted shrink-0">
                        {prof.Telephone && (
                          <span className="flex items-center gap-1"><Phone size={11} />{prof.Telephone}</span>
                        )}
                        {prof.Email && <span className="truncate max-w-[180px]">{prof.Email}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteProfesseur(prof.ID, prof.Nom)}
                      className="px-4 py-4 text-muted hover:text-red-500 transition-colors shrink-0"
                      title="Supprimer ce professeur"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        }
      </section>

      {/* SlideOver ajouter professeur */}
      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title="Ajouter un professeur" width="md">
        <form onSubmit={e => { e.preventDefault(); handleAddProfesseur() }} className="flex flex-col gap-4">
          <Field label="Nom" required>
            <Input value={profForm.Nom} onChange={e => setProfForm(f => ({ ...f, Nom: e.target.value }))} />
          </Field>
          <FormRow>
            <Field label="Téléphone">
              <Input value={profForm.Telephone} onChange={e => setProfForm(f => ({ ...f, Telephone: e.target.value }))} />
            </Field>
            <Field label="Email">
              <Input type="email" value={profForm.Email} onChange={e => setProfForm(f => ({ ...f, Email: e.target.value }))} />
            </Field>
          </FormRow>
          <SaveButton accent="familles" label={saving ? "Enregistrement…" : "Enregistrer"} />
        </form>
      </SlideOver>
    </div>
  )
}
