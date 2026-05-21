"use client"

import { useState, useMemo, useEffect } from "react"
import { communication } from "@/lib/mock-data"
import { Calendar, Columns3, Check, X, RotateCcw, Plus, Pencil, CalendarDays, Shuffle, CheckCircle2, XCircle, ChevronRight } from "lucide-react"
import SlideOver, { Field, Input, Textarea, Select, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"

const STORAGE_POSTS         = "asso-communication-posts"
const STORAGE_EVENTS        = "asso-communication-events"
const STORAGE_INTEGRATIONS  = "asso-communication-integrations"
const STORAGE_REJECTED      = "asso-communication-rejected"

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}

// ──────────────────────────────────────────────
// Types & données
// ──────────────────────────────────────────────
type ValidationStatus = "brouillon" | "soumis" | "approuvé" | "publié"
type Plateforme = "LinkedIn" | "Instagram" | "Facebook"
type TypeEvenement = "atelier" | "événement" | "cérémonie"

interface Evenement {
  id: number
  nom: string
  date: string
  type: TypeEvenement
}

interface IntegrationsConfig {
  method: "none" | "zapier" | "supabase"
  zapierWebhookUrl: string
  zapierTriggerOn: "approuvé" | "publié"
  zapierEnabled: boolean
}

const integrationsInitial: IntegrationsConfig = {
  method: "none",
  zapierWebhookUrl: "",
  zapierTriggerOn: "approuvé",
  zapierEnabled: false,
}

interface Post {
  id: number
  date: string
  titre: string
  contenu?: string
  plateforme: Plateforme[]
  statut: ValidationStatus
  auteur: string
  evenement?: string | null
}

const postsInitiaux: Post[] = [
  { id: 1, date: "2026-05-21", titre: "Recap atelier HTML/CSS",       contenu: "Super séance aujourd'hui avec nos débutantes ! 💻 Elles ont créé leur première page web from scratch…",         plateforme: ["LinkedIn", "Instagram"], statut: "soumis",   auteur: "Nadjat",  evenement: "Atelier 21 mai" },
  { id: 2, date: "2026-05-23", titre: "Portrait bénévole – Amira",    contenu: "Rencontre avec Amira, bénévole depuis 2 ans. Elle nous parle de ce qui l'a amenée à rejoindre l'association…",    plateforme: ["Instagram"],             statut: "brouillon", auteur: "Nadjat",  evenement: null },
  { id: 3, date: "2026-05-27", titre: "Annonce portes ouvertes",       contenu: "📣 Portes ouvertes le 7 juin ! Venez découvrir nos ateliers, rencontrer l'équipe et vous inscrire pour la rentrée.", plateforme: ["LinkedIn", "Instagram", "Facebook"], statut: "brouillon", auteur: "Nadjat", evenement: "Portes ouvertes 7 juin" },
  { id: 4, date: "2026-06-07", titre: "Live portes ouvertes",          contenu: "🔴 On est EN DIRECT depuis nos portes ouvertes ! Rejoignez-nous pour voir ce qui se passe…",                      plateforme: ["Instagram"],             statut: "approuvé",  auteur: "Nadjat",  evenement: "Portes ouvertes 7 juin" },
  { id: 5, date: "2026-06-28", titre: "Remise des diplômes Promo 3",   contenu: "Félicitations à toutes les diplômées de la Promo 3 ! 🎓 Quelle fierté de les accompagner jusqu'au bout.",          plateforme: ["LinkedIn", "Instagram", "Facebook"], statut: "brouillon", auteur: "Somayeh", evenement: "Remise des diplômes" },
  { id: 6, date: "2026-05-15", titre: "Témoignage Mariam D.",          contenu: "Mariam partage son parcours : de zéro à la création de son premier site web en 8 semaines.",                       plateforme: ["LinkedIn"],              statut: "publié",    auteur: "Nadjat",  evenement: null },
]

const KANBAN_COLS: { id: ValidationStatus; label: string; color: string }[] = [
  { id: "brouillon", label: "Brouillon",  color: "bg-slate-100 border-slate-200" },
  { id: "soumis",    label: "Soumis",     color: "bg-absences-light border-absences/30" },
  { id: "approuvé",  label: "Approuvé",   color: "bg-indigo-50 border-indigo-200" },
  { id: "publié",    label: "Publié",     color: "bg-emerald-50 border-emerald-200" },
]

const PlatIcon = ({ p }: { p: Plateforme }) => {
  if (p === "Instagram") return <span className="text-[10px] font-bold">IG</span>
  if (p === "LinkedIn")  return <span className="text-[10px] font-bold">LI</span>
  return <span className="text-[10px] font-bold">FB</span>
}

const plateformeStyle: Record<Plateforme, string> = {
  LinkedIn:  "bg-blue-100 text-blue-700",
  Instagram: "bg-purple-100 text-purple-700",
  Facebook:  "bg-indigo-100 text-indigo-700",
}

// ──────────────────────────────────────────────
// Calendrier éditorial (4.1)
// ──────────────────────────────────────────────
function CalendrierTab({ posts, onNewPost }: { posts: Post[]; onNewPost: (date: string) => void }) {
  const today = new Date("2026-05-20")
  const [displayYear, setDisplayYear] = useState(today.getFullYear())
  const [displayMonth, setDisplayMonth] = useState(today.getMonth())

  const year = displayYear
  const month = displayMonth
  const monthLabel = new Date(year, month, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

  const minDate = new Date(today.getFullYear() - 1, today.getMonth(), 1)
  const maxDate = new Date(today.getFullYear() + 2, today.getMonth(), 1)
  const canGoPrev = new Date(year, month - 1, 1) >= minDate
  const canGoNext = new Date(year, month + 1, 1) <= maxDate

  function prevMonth() {
    if (!canGoPrev) return
    if (month === 0) { setDisplayYear(y => y - 1); setDisplayMonth(11) }
    else { setDisplayMonth(m => m - 1) }
  }

  function nextMonth() {
    if (!canGoNext) return
    if (month === 11) { setDisplayYear(y => y + 1); setDisplayMonth(0) }
    else { setDisplayMonth(m => m + 1) }
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = (firstDay + 6) % 7 // lundi = 0

  const postsByDay = useMemo(() => {
    const map: Record<number, Post[]> = {}
    posts.forEach((p) => {
      const d = new Date(p.date)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        if (!map[day]) map[day] = []
        map[day].push(p)
      }
    })
    return map
  }, [posts, year, month])

  const statutDot: Record<ValidationStatus, string> = {
    brouillon: "bg-slate-300",
    soumis:    "bg-absences",
    approuvé:  "bg-indigo-600",
    publié:    "bg-emerald-500",
  }

  const statutBg: Record<ValidationStatus, string> = {
    brouillon: "bg-slate-100 text-slate-600",
    soumis:    "bg-absences-light text-absences-dark",
    approuvé:  "bg-indigo-100 text-indigo-700",
    publié:    "bg-emerald-50 text-emerald-700",
  }

  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="p-1 rounded-lg hover:bg-slate-100 text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} className="rotate-180" />
          </button>
          <h2 className="text-base font-semibold capitalize text-foreground w-44 text-center">{monthLabel}</h2>
          <button
            onClick={nextMonth}
            disabled={!canGoNext}
            className="p-1 rounded-lg hover:bg-slate-100 text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {Object.entries(statutDot).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${c}`} />{s}</span>
          ))}
        </div>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted mb-1">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => <div key={d}>{d}</div>)}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const isToday = day === today.getDate() && year === today.getFullYear() && month === today.getMonth()
          const dayPosts = postsByDay[day] ?? []

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

          return (
            <div
              key={i}
              onClick={() => onNewPost(dateStr)}
              className={`min-h-24 rounded-lg border p-1.5 text-xs cursor-pointer ${isToday ? "border-ateliers bg-ateliers-light hover:bg-ateliers-light/80" : "border-border bg-surface hover:bg-slate-50"}`}
            >
              <div className={`font-semibold mb-1 ${isToday ? "text-ateliers-dark" : "text-muted"}`}>{day}</div>
              {dayPosts.map((p) => (
                <div
                  key={p.id}
                  onClick={(e) => e.stopPropagation()}
                  className={`flex items-center gap-1 mb-0.5 px-1 py-0.5 rounded ${statutBg[p.statut]}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statutDot[p.statut]}`} />
                  <span className="truncate text-[10px] font-medium">{p.titre}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

    </div>
  )
}

// ──────────────────────────────────────────────
// Onglet Événements — CRUD
// ──────────────────────────────────────────────
const TYPE_OPTIONS: { value: TypeEvenement; label: string; cls: string }[] = [
  { value: "atelier",     label: "Atelier",     cls: "bg-ateliers-light text-ateliers-dark" },
  { value: "événement",   label: "Événement",   cls: "bg-communication-light text-communication-dark" },
  { value: "cérémonie",   label: "Cérémonie",   cls: "bg-finances-light text-finances-dark" },
]

function EventsTab({ events, onEdit, onNew }: {
  events: Evenement[]
  onEdit: (e: Evenement) => void
  onNew: () => void
}) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Ces événements apparaissent dans le calendrier éditorial et peuvent être liés aux posts.</p>
        <button onClick={onNew} className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors">
          <Plus size={14} /> Nouvel événement
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-muted text-sm">
          <CalendarDays size={32} className="mx-auto mb-3 opacity-30" />
          Aucun événement. Commencez par en créer un.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {sorted.map((e, i) => {
            const typeOpt = TYPE_OPTIONS.find((t) => t.value === e.type) ?? TYPE_OPTIONS[1]
            return (
              <div key={e.id} className={`flex items-center gap-4 px-5 py-4 group hover:bg-slate-50 transition-colors ${i > 0 ? "border-t border-border" : ""}`}>
                <div className="text-center min-w-12 shrink-0">
                  <p className="text-lg font-bold text-foreground leading-none">
                    {new Date(e.date).toLocaleDateString("fr-FR", { day: "numeric" })}
                  </p>
                  <p className="text-[10px] text-muted uppercase tracking-wide">
                    {new Date(e.date).toLocaleDateString("fr-FR", { month: "short" })}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{e.nom}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${typeOpt.cls}`}>
                  {typeOpt.label}
                </span>
                <button
                  onClick={() => onEdit(e)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-muted opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Pencil size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Panneau de lecture d'un post
// ──────────────────────────────────────────────
const statutLabel: Record<ValidationStatus, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon",  cls: "bg-slate-100 text-slate-600" },
  soumis:    { label: "Soumis",     cls: "bg-absences-light text-absences-dark" },
  approuvé:  { label: "Approuvé",   cls: "bg-indigo-100 text-indigo-700" },
  publié:    { label: "Publié",     cls: "bg-emerald-50 text-emerald-700" },
}

function PostReadSlideOver({ post, onClose, onEdit }: { post: Post | null; onClose: () => void; onEdit: (p: Post) => void }) {
  if (!post) return null
  const { label, cls } = statutLabel[post.statut]
  return (
    <SlideOver open={!!post} onClose={onClose} title={post.titre} subtitle={`Par ${post.auteur} · ${new Date(post.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`} width="lg">
      <div className="flex flex-col gap-5">
        {/* Statut + plateformes */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
          {post.plateforme.map((pl) => (
            <span key={pl} className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${plateformeStyle[pl]}`}>
              <PlatIcon p={pl} /> {pl}
            </span>
          ))}
          {post.evenement && (
            <span className="text-xs bg-absences-light text-absences-dark px-2.5 py-1 rounded-full">📅 {post.evenement}</span>
          )}
        </div>

        {/* Contenu du post */}
        <div className="bg-slate-50 rounded-xl p-4 border border-border">
          {post.contenu ? (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.contenu}</p>
          ) : (
            <p className="text-sm text-muted italic">Aucun contenu rédigé.</p>
          )}
        </div>

        {/* Métadonnées */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-surface rounded-lg border border-border p-3">
            <p className="text-muted mb-0.5">Auteur</p>
            <p className="font-medium text-foreground">{post.auteur || "—"}</p>
          </div>
          <div className="bg-surface rounded-lg border border-border p-3">
            <p className="text-muted mb-0.5">Date de publication</p>
            <p className="font-medium text-foreground">{new Date(post.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>

        {/* Bouton modifier */}
        <button
          onClick={() => { onClose(); setTimeout(() => onEdit(post), 150) }}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          <Pencil size={13} /> Modifier ce post
        </button>
      </div>
    </SlideOver>
  )
}

// ──────────────────────────────────────────────
// Kanban de validation (4.2)
// ──────────────────────────────────────────────
function KanbanTab({ posts, rejectedIds, onChangeStatus, onEdit, onRead }: {
  posts: Post[]
  rejectedIds: number[]
  onChangeStatus: (id: number, status: ValidationStatus) => void
  onEdit: (p: Post) => void
  onRead: (p: Post) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Circuit de validation : <span className="font-medium text-foreground">Brouillon → Soumis → Approuvé → Publié</span>.
        Cliquez sur une carte pour lire le post, ou utilisez les boutons pour le faire avancer.
      </p>

      <div className="grid grid-cols-4 gap-4">
        {KANBAN_COLS.map((col) => {
          const colPosts = posts.filter((p) => p.statut === col.id)
          return (
            <div key={col.id} className={`rounded-xl border-2 p-3 flex flex-col gap-3 min-h-48 ${col.color}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                <span className="text-xs bg-white/70 rounded-full px-2 py-0.5 font-medium text-muted">{colPosts.length}</span>
              </div>
              {colPosts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onRead(p)}
                  className="relative bg-white rounded-xl p-3 shadow-sm border border-white flex flex-col gap-2 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all group"
                >
                  {rejectedIds.includes(p.id) && (
                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
                  )}
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-semibold text-foreground leading-snug flex-1 group-hover:text-ateliers-dark transition-colors">{p.titre}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(p) }}
                      className="p-1 rounded hover:bg-slate-100 text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.plateforme.map((pl) => (
                      <span key={pl} className={`flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${plateformeStyle[pl]}`}>
                        <PlatIcon p={pl} /> {pl}
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted">
                    {new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </div>
                  {/* Actions */}
                  <div className="flex gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                    {p.statut === "brouillon" && (
                      <button onClick={() => onChangeStatus(p.id, "soumis")} className="flex-1 text-[10px] bg-ateliers-light text-ateliers-dark rounded-lg py-1 font-medium hover:opacity-80">Soumettre</button>
                    )}
                    {p.statut === "soumis" && <>
                      <button onClick={() => onChangeStatus(p.id, "approuvé")} className="flex-1 text-[10px] bg-finances-light text-finances-dark rounded-lg py-1 font-medium hover:opacity-80 flex items-center justify-center gap-1"><Check size={10} /> Approuver</button>
                      <button onClick={() => onChangeStatus(p.id, "brouillon")} className="text-[10px] bg-red-50 text-alert rounded-lg px-2 py-1 font-medium hover:opacity-80 flex items-center gap-1"><X size={10} /></button>
                    </>}
                    {p.statut === "approuvé" && <>
                      <button onClick={() => onChangeStatus(p.id, "publié")} className="flex-1 text-[10px] bg-emerald-100 text-emerald-700 rounded-lg py-1 font-medium hover:opacity-80">Marquer publié</button>
                      <button onClick={() => onChangeStatus(p.id, "soumis")} className="text-[10px] bg-slate-100 text-muted rounded-lg px-2 py-1 hover:opacity-80"><RotateCcw size={10} /></button>
                    </>}
                    {p.statut === "publié" && (
                      <span className="flex-1 text-[10px] text-center text-emerald-600 font-medium py-1">✓ Publié</span>
                    )}
                  </div>
                </div>
              ))}
              {colPosts.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-xs text-muted/50 italic">Vide</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Onglet Intégrations — connexion réseaux sociaux
// ──────────────────────────────────────────────
function IntegrationsTab({
  config,
  onChange,
  onTest,
  testStatus,
}: {
  config: IntegrationsConfig
  onChange: (c: IntegrationsConfig) => void
  onTest: () => void
  testStatus: "idle" | "sending" | "ok" | "error"
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Connectez vos réseaux sociaux pour automatiser la publication des posts approuvés.
        Choisissez votre méthode selon votre infrastructure.
      </p>

      {/* Choix de méthode */}
      <div className="grid grid-cols-2 gap-4">
        {/* Zapier / Make */}
        <div
          onClick={() => onChange({ ...config, method: "zapier" })}
          className={`rounded-2xl border-2 p-5 flex flex-col gap-4 cursor-pointer transition-colors ${
            config.method === "zapier" ? "border-ateliers bg-ateliers-light" : "border-border bg-surface hover:bg-slate-50"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-bold text-foreground">Zapier / Make</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Disponible</span>
              </div>
              <p className="text-xs text-muted">Via webhook HTTP — aucun backend requis</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-colors ${config.method === "zapier" ? "border-ateliers bg-ateliers" : "border-slate-300"}`} />
          </div>
          <ul className="text-xs text-muted space-y-1.5">
            <li className="flex items-start gap-1.5"><span className="text-emerald-500 shrink-0 font-bold">✓</span> Fonctionne sans backend</li>
            <li className="flex items-start gap-1.5"><span className="text-emerald-500 shrink-0 font-bold">✓</span> Configure en 10 minutes</li>
            <li className="flex items-start gap-1.5"><span className="text-slate-400 shrink-0">·</span> Compte Zapier ou Make requis</li>
            <li className="flex items-start gap-1.5"><span className="text-slate-400 shrink-0">·</span> Peut être payant selon le volume</li>
          </ul>
        </div>

        {/* Supabase */}
        <div className="rounded-2xl border-2 border-border bg-surface p-5 flex flex-col gap-4 opacity-50 cursor-not-allowed">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-bold text-foreground">Supabase</span>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">Phase 2</span>
              </div>
              <p className="text-xs text-muted">Via Edge Functions — intégration native</p>
            </div>
            <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0 mt-0.5" />
          </div>
          <ul className="text-xs text-muted space-y-1.5">
            <li className="flex items-start gap-1.5"><span className="text-emerald-500 shrink-0 font-bold">✓</span> Tokens OAuth sécurisés côté serveur</li>
            <li className="flex items-start gap-1.5"><span className="text-emerald-500 shrink-0 font-bold">✓</span> Publication directe sans outil tiers</li>
            <li className="flex items-start gap-1.5"><span className="text-slate-400 shrink-0">⏳</span> Nécessite la migration Supabase (ADR 001)</li>
            <li className="flex items-start gap-1.5"><span className="text-slate-400 shrink-0">⏳</span> Validation Meta & LinkedIn requise</li>
          </ul>
        </div>
      </div>

      {/* Config Zapier/Make */}
      {config.method === "zapier" && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-5">
          <h3 className="text-sm font-semibold text-foreground">Configuration Zapier / Make</h3>

          {/* URL webhook */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">URL du webhook</label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={config.zapierWebhookUrl}
                onChange={(e) => onChange({ ...config, zapierWebhookUrl: e.target.value })}
                className="flex-1 text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ateliers/30"
              />
              <button
                type="button"
                onClick={onTest}
                disabled={!config.zapierWebhookUrl || testStatus === "sending"}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {testStatus === "sending" && <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />}
                {testStatus === "ok"      && <CheckCircle2 size={13} className="text-emerald-500" />}
                {testStatus === "error"   && <XCircle size={13} className="text-alert" />}
                {testStatus === "idle"    && "Tester"}
                {testStatus === "sending" && "Envoi…"}
                {testStatus === "ok"      && "OK !"}
                {testStatus === "error"   && "Erreur"}
              </button>
            </div>
            <p className="text-[11px] text-muted">Créez un Zap ou un scénario Make avec déclencheur "Webhook", copiez l'URL ici.</p>
          </div>

          {/* Déclencheur */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Déclencher automatiquement quand un post est</label>
            <div className="flex gap-2">
              {(["approuvé", "publié"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange({ ...config, zapierTriggerOn: v })}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors capitalize ${
                    config.zapierTriggerOn === v
                      ? "bg-ateliers-light text-ateliers-dark border-ateliers/30"
                      : "bg-surface border-border text-muted hover:border-slate-400"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle activer */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Activer l'envoi automatique</p>
              <p className="text-xs text-muted mt-0.5">Le webhook sera appelé à chaque changement de statut correspondant</p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...config, zapierEnabled: !config.zapierEnabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.zapierEnabled ? "bg-ateliers" : "bg-slate-200"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config.zapierEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {/* Statut connexion */}
          {config.zapierEnabled && config.zapierWebhookUrl && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              Actif — les posts marqués &ldquo;{config.zapierTriggerOn}&rdquo; déclencheront le webhook
            </div>
          )}
        </div>
      )}

      {/* Guide rapide Zapier/Make */}
      {config.method === "zapier" && (
        <div className="bg-slate-50 border border-border rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Guide rapide</h3>
          <ol className="text-xs text-muted space-y-2 list-decimal list-inside">
            <li>Créez un compte <strong className="text-foreground">Zapier</strong> (gratuit) ou <strong className="text-foreground">Make</strong> (gratuit jusqu'à 1 000 opérations/mois)</li>
            <li>Créez un Zap / scénario avec le déclencheur <strong className="text-foreground">Webhooks → Catch Hook</strong></li>
            <li>Copiez l'URL du webhook et collez-la dans le champ ci-dessus</li>
            <li>Ajoutez une action par réseau : <strong className="text-foreground">LinkedIn for Business</strong>, <strong className="text-foreground">Instagram for Business</strong>, <strong className="text-foreground">Facebook Pages</strong></li>
            <li>Connectez vos comptes sociaux dans Zapier / Make (OAuth géré par eux)</li>
            <li>Mappez les champs : <code className="bg-slate-200 px-1 rounded">titre</code>, <code className="bg-slate-200 px-1 rounded">contenu</code>, <code className="bg-slate-200 px-1 rounded">plateformes</code></li>
          </ol>
          <div className="flex gap-3 pt-1">
            <a href="https://zapier.com" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-ateliers-dark hover:underline">→ zapier.com</a>
            <span className="text-border">·</span>
            <a href="https://make.com" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-ateliers-dark hover:underline">→ make.com</a>
          </div>
        </div>
      )}

      {/* Aucune méthode sélectionnée */}
      {config.method === "none" && (
        <div className="text-center py-10 text-muted text-sm">
          <Shuffle size={28} className="mx-auto mb-3 opacity-30" />
          Sélectionnez une méthode d'intégration ci-dessus pour la configurer.
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Page principale
// ──────────────────────────────────────────────
const eventsInitiaux: Evenement[] = communication.evenements as Evenement[]

const emptyPost = (): Omit<Post, "id"> => ({
  date: new Date().toISOString().split("T")[0],
  titre: "", contenu: "", plateforme: ["Instagram"],
  statut: "brouillon", auteur: "", evenement: null,
})

const emptyEvent = (): Omit<Evenement, "id"> => ({
  nom: "", date: new Date().toISOString().split("T")[0], type: "événement",
})

const ALL_PLATEFORMES: Plateforme[] = ["LinkedIn", "Instagram", "Facebook"]

export default function CommunicationPage() {
  const [tab, setTab] = useState<"calendrier" | "kanban" | "evenements" | "integrations">("calendrier")

  // Posts
  const [posts, setPosts] = useState<Post[]>(postsInitiaux)
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing, setEditing] = useState<Post | null>(null)
  const [form, setForm] = useState<Omit<Post, "id">>(emptyPost())
  const [viewingPost, setViewingPost] = useState<Post | null>(null)

  // Événements
  const [events, setEvents] = useState<Evenement[]>(eventsInitiaux)
  const [eventSlideOpen, setEventSlideOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Evenement | null>(null)
  const [eventForm, setEventForm] = useState<Omit<Evenement, "id">>(emptyEvent())

  // Intégrations
  const [integrations, setIntegrations] = useState<IntegrationsConfig>(integrationsInitial)
  const [webhookTestStatus, setWebhookTestStatus] = useState<"idle" | "sending" | "ok" | "error">("idle")

  // Posts renvoyés en brouillon depuis soumis
  const [rejectedIds, setRejectedIds] = useState<number[]>([])

  useEffect(() => {
    setPosts(load(STORAGE_POSTS, postsInitiaux))
    setEvents(load(STORAGE_EVENTS, eventsInitiaux))
    setIntegrations(load(STORAGE_INTEGRATIONS, integrationsInitial))
    setRejectedIds(load(STORAGE_REJECTED, []))
  }, [])

  function persistPosts(data: Post[]) { setPosts(data); localStorage.setItem(STORAGE_POSTS, JSON.stringify(data)) }
  function persistEvents(data: Evenement[]) { setEvents(data); localStorage.setItem(STORAGE_EVENTS, JSON.stringify(data)) }
  function persistIntegrations(data: IntegrationsConfig) { setIntegrations(data); localStorage.setItem(STORAGE_INTEGRATIONS, JSON.stringify(data)) }
  function persistRejected(data: number[]) { setRejectedIds(data); localStorage.setItem(STORAGE_REJECTED, JSON.stringify(data)) }

  // ── Webhook ───────────────────────────────
  async function triggerWebhook(post: Post) {
    if (!integrations.zapierEnabled || !integrations.zapierWebhookUrl || integrations.method !== "zapier") return
    if (post.statut !== integrations.zapierTriggerOn) return
    try {
      await fetch(integrations.zapierWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: post.titre,
          contenu: post.contenu ?? "",
          plateformes: post.plateforme,
          auteur: post.auteur,
          date: post.date,
          evenement: post.evenement ?? null,
        }),
      })
    } catch { /* silently ignore */ }
  }

  async function testWebhook() {
    if (!integrations.zapierWebhookUrl) return
    setWebhookTestStatus("sending")
    try {
      await fetch(integrations.zapierWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: "Test depuis Asso Pilotage",
          contenu: "Ceci est un test de connexion webhook.",
          plateformes: ["LinkedIn"],
          auteur: "Test",
          date: new Date().toISOString().split("T")[0],
          evenement: null,
        }),
      })
      setWebhookTestStatus("ok")
    } catch {
      setWebhookTestStatus("error")
    }
    setTimeout(() => setWebhookTestStatus("idle"), 3000)
  }

  // ── Posts CRUD ────────────────────────────
  function changeStatus(id: number, status: ValidationStatus) {
    const current = posts.find((p) => p.id === id)
    const updated = posts.map((p) => p.id === id ? { ...p, statut: status } : p)
    persistPosts(updated)

    // Dot rouge : soumis → brouillon = ajouter ; brouillon → soumis = retirer
    if (current?.statut === "soumis" && status === "brouillon") {
      persistRejected([...rejectedIds, id])
    } else if (current?.statut === "brouillon" && status === "soumis") {
      persistRejected(rejectedIds.filter((rid) => rid !== id))
    }

    const post = updated.find((p) => p.id === id)
    if (post) triggerWebhook({ ...post, statut: status })
  }

  function openNew() { setEditing(null); setForm(emptyPost()); setSlideOpen(true) }
  function openNewWithDate(date: string) { setEditing(null); setForm({ ...emptyPost(), date }); setSlideOpen(true) }
  function openEdit(p: Post) { setEditing(p); setForm({ ...p, plateforme: [...p.plateforme] }); setSlideOpen(true) }

  function handleSave() {
    const updated = editing
      ? posts.map((p) => p.id === editing.id ? { ...form, id: editing.id } : p)
      : [...posts, { ...form, id: Date.now() }]
    persistPosts(updated); setSlideOpen(false)
  }

  function handleDelete() {
    if (!editing) return
    persistPosts(posts.filter((p) => p.id !== editing.id))
    setSlideOpen(false)
  }

  function togglePlateforme(pl: Plateforme) {
    setForm((f) => ({
      ...f,
      plateforme: f.plateforme.includes(pl) ? f.plateforme.filter((x) => x !== pl) : [...f.plateforme, pl],
    }))
  }

  // ── Événements CRUD ───────────────────────
  function openNewEvent() { setEditingEvent(null); setEventForm(emptyEvent()); setEventSlideOpen(true) }
  function openEditEvent(e: Evenement) { setEditingEvent(e); setEventForm({ nom: e.nom, date: e.date, type: e.type }); setEventSlideOpen(true) }

  function handleSaveEvent() {
    if (!eventForm.nom.trim()) return
    const updated = editingEvent
      ? events.map((e) => e.id === editingEvent.id ? { ...eventForm, id: editingEvent.id } : e)
      : [...events, { ...eventForm, id: Date.now() }]
    persistEvents(updated); setEventSlideOpen(false)
  }

  function handleDeleteEvent() {
    if (!editingEvent) return
    persistEvents(events.filter((e) => e.id !== editingEvent.id))
    setEventSlideOpen(false)
  }

  // ── Stats ─────────────────────────────────
  const currentYear      = new Date().getFullYear()
  const debutAnnee       = new Date(currentYear, 0, 1)
  const nbBrouillons     = posts.filter((p) => p.statut === "brouillon").length
  const nbSoumis         = posts.filter((p) => p.statut === "soumis").length
  const nbPubliesAnnee   = posts.filter((p) => p.statut === "publié" && new Date(p.date) >= debutAnnee).length

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Communication</h1>
          <p className="text-sm text-muted mt-1">Calendrier éditorial & circuit de validation des posts</p>
        </div>
        {tab !== "evenements" && (
          <button onClick={openNew} className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors">
            <Plus size={14} /> Nouveau post
          </button>
        )}
      </header>

      {/* SlideOver post */}
      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title={editing ? "Modifier le post" : "Nouveau post"} width="lg">
        <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="flex flex-col gap-4">
          <Field label="Titre" required>
            <Input placeholder="Ex: Recap atelier HTML/CSS" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} />
          </Field>
          <Field label="Contenu">
            <Textarea rows={5} placeholder="Texte du post…" value={form.contenu ?? ""} onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))} />
          </Field>
          <Field label="Plateformes">
            <div className="flex gap-2">
              {ALL_PLATEFORMES.map((pl) => (
                <button type="button" key={pl} onClick={() => togglePlateforme(pl)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${form.plateforme.includes(pl) ? plateformeStyle[pl] + " border-transparent" : "bg-surface border-border text-muted hover:border-slate-400"}`}
                >
                  {pl}
                </button>
              ))}
            </div>
          </Field>
          <FormRow>
            <Field label="Date de publication">
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </Field>
            <Field label="Statut">
              <Select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as ValidationStatus }))}>
                <option>brouillon</option><option>soumis</option><option>approuvé</option><option>publié</option>
              </Select>
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Auteur">
              <Input placeholder="Nadjat" value={form.auteur} onChange={e => setForm(f => ({ ...f, auteur: e.target.value }))} />
            </Field>
            <Field label="Événement lié">
              <Select value={form.evenement ?? ""} onChange={e => setForm(f => ({ ...f, evenement: e.target.value || null }))}>
                <option value="">— Aucun —</option>
                {events.map((e) => <option key={e.id} value={e.nom}>{e.nom}</option>)}
              </Select>
            </Field>
          </FormRow>
          <SaveButton />
          {editing && <DeleteButton onClick={handleDelete} />}
        </form>
      </SlideOver>

      {/* SlideOver événement */}
      <SlideOver open={eventSlideOpen} onClose={() => setEventSlideOpen(false)} title={editingEvent ? `Modifier — ${editingEvent.nom}` : "Nouvel événement"} width="md">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveEvent() }} className="flex flex-col gap-4">
          <Field label="Nom de l'événement" required>
            <Input placeholder="Ex: Portes ouvertes" value={eventForm.nom} onChange={e => setEventForm(f => ({ ...f, nom: e.target.value }))} />
          </Field>
          <Field label="Date" required>
            <Input type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} />
          </Field>
          <Field label="Type">
            <Select value={eventForm.type} onChange={e => setEventForm(f => ({ ...f, type: e.target.value as TypeEvenement }))}>
              <option value="atelier">Atelier</option>
              <option value="événement">Événement</option>
              <option value="cérémonie">Cérémonie</option>
            </Select>
          </Field>
          <SaveButton />
          {editingEvent && <DeleteButton onClick={handleDeleteEvent} />}
        </form>
      </SlideOver>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-100 rounded-xl border border-slate-200 p-4">
          <p className="text-3xl font-bold text-slate-700">{nbBrouillons}</p>
          <p className="text-sm text-slate-500 mt-1">En cours de rédaction</p>
        </div>
        <div className="bg-absences-light rounded-xl border border-absences/20 p-4">
          <p className="text-3xl font-bold text-absences-dark">{nbSoumis}</p>
          <p className="text-sm text-absences-dark/70 mt-1">En attente de validation</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <p className="text-3xl font-bold text-emerald-700">{nbPubliesAnnee}</p>
          <p className="text-sm text-emerald-600/70 mt-1">Publiés en {currentYear}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("calendrier")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "calendrier" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          <Calendar size={14} /> Calendrier
        </button>
        <button
          onClick={() => setTab("kanban")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "kanban" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          <Columns3 size={14} /> Validation
        </button>
        <button
          onClick={() => setTab("evenements")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "evenements" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          <CalendarDays size={14} /> Événements
          <span className="text-[10px] bg-absences-light text-absences-dark px-1.5 py-0.5 rounded-full font-semibold">{events.length}</span>
        </button>
        <button
          onClick={() => setTab("integrations")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "integrations" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          <Shuffle size={14} /> Intégrations
          {integrations.zapierEnabled && integrations.zapierWebhookUrl && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          )}
        </button>
      </div>

      {tab === "calendrier"   && <CalendrierTab posts={posts} onNewPost={openNewWithDate} />}
      {tab === "kanban"       && <KanbanTab posts={posts} rejectedIds={rejectedIds} onChangeStatus={changeStatus} onEdit={openEdit} onRead={(p) => setViewingPost(p)} />}
      {tab === "evenements"   && <EventsTab events={events} onEdit={openEditEvent} onNew={openNewEvent} />}
      {tab === "integrations" && <IntegrationsTab config={integrations} onChange={persistIntegrations} onTest={testWebhook} testStatus={webhookTestStatus} />}

      <PostReadSlideOver
        post={viewingPost}
        onClose={() => setViewingPost(null)}
        onEdit={(p) => { setViewingPost(null); openEdit(p) }}
      />
    </div>
  )
}
