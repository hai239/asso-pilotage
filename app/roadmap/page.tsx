"use client"

import { useState, useEffect } from "react"
import { themes, allUseCases, TOTAL_SUB_ACTIONS, TOTAL_USE_CASES, type Status, type UseCase } from "@/lib/roadmap-data"
import { ChevronDown, ChevronRight, CheckCircle2, Circle, Timer, BarChart2, List, StickyNote } from "lucide-react"

const STORAGE_KEY = "asso-roadmap-statuses"

function loadStatuses(): Record<string, Status> {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") } catch { return {} }
}

function saveStatuses(s: Record<string, Status>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

const STATUS_CYCLE: Status[] = ["not_started", "in_progress", "done"]
const statusLabel: Record<Status, string> = { not_started: "À faire", in_progress: "En cours", done: "Fait" }
const statusColor: Record<Status, string> = {
  not_started: "text-slate-400",
  in_progress: "text-amber-500",
  done: "text-emerald-500",
}
const statusBg: Record<Status, string> = {
  not_started: "bg-slate-100 text-slate-500",
  in_progress: "bg-amber-50 text-amber-700",
  done: "bg-emerald-50 text-emerald-700",
}
const StatusIcon = ({ status }: { status: Status }) => {
  if (status === "done") return <CheckCircle2 size={15} className="text-emerald-500" />
  if (status === "in_progress") return <Timer size={15} className="text-amber-500" />
  return <Circle size={15} className="text-slate-300" />
}

function ScoreBadge({ label, value }: { label: string; value?: number }) {
  if (value === undefined) return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">{label} ?</span>
  const colors = ["", "bg-red-100 text-red-700", "bg-amber-100 text-amber-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700"]
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[value]}`}>{label} {value}/4</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// MATRICE VIEW
// ─────────────────────────────────────────────────────────────────────────────
function MatriceView({ statuses }: { statuses: Record<string, Status> }) {
  const scored = allUseCases.filter((uc) => uc.impact !== undefined && uc.ease !== undefined)
  const unscored = allUseCases.filter((uc) => uc.impact === undefined || uc.ease === undefined)

  type UCWithTheme = (typeof allUseCases)[number]
  const grid: UCWithTheme[][][] = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => []))
  scored.forEach((uc) => {
    const row = 4 - (uc.impact ?? 1)   // impact 4 → row 0 (top)
    const col = (uc.ease ?? 1) - 1     // ease 1 → col 0 (left)
    grid[row][col].push(uc)
  })

  const quadrantLabel = (row: number, col: number) => {
    const highImpact = row < 2
    const highEase = col >= 2
    if (highImpact && highEase) return { label: "Gains rapides", color: "bg-emerald-50 border-emerald-200" }
    if (highImpact && !highEase) return { label: "Projets majeurs", color: "bg-blue-50 border-blue-200" }
    if (!highImpact && highEase) return { label: "Compléments", color: "bg-slate-50 border-slate-200" }
    return { label: "À reconsidérer", color: "bg-red-50 border-red-200" }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 text-xs text-muted items-center">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" /> Gains rapides (impact élevé, facile)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" /> Projets majeurs (impact élevé, complexe)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-300 inline-block" /> Compléments</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-300 inline-block" /> À reconsidérer</div>
      </div>

      {/* Axes labels */}
      <div className="flex gap-3">
        {/* Y axis label */}
        <div className="flex flex-col items-center justify-center w-6 shrink-0">
          <span className="text-xs text-muted -rotate-90 whitespace-nowrap origin-center" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>↑ Impact</span>
        </div>
        <div className="flex-1">
          {/* X axis label */}
          <div className="text-center text-xs text-muted mb-2">Facilité →</div>
          <div className="text-xs text-muted flex justify-between mb-1 px-1">
            <span>Difficile</span>
            <span>Facile</span>
          </div>
          {/* 4×4 grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {grid.map((row, ri) =>
              row.map((cell, ci) => {
                const { color } = quadrantLabel(ri, ci)
                return (
                  <div key={`${ri}-${ci}`} className={`min-h-20 rounded-lg border p-2 ${color} flex flex-col gap-1`}>
                    <div className="text-xs text-slate-400 font-mono">I{4 - ri} F{ci + 1}</div>
                    {cell.map((uc) => {
                      const doneCount = uc.subActions.filter((sa) => statuses[sa.id] === "done").length
                      return (
                        <div key={uc.id} className="text-xs bg-white rounded px-2 py-1 shadow-sm border border-white/80">
                          <span className="font-semibold text-slate-700">{uc.id}</span>
                          <span className="text-slate-600 ml-1">{uc.title.length > 28 ? uc.title.slice(0, 28) + "…" : uc.title}</span>
                          {uc.notes && <span className="block text-slate-400 italic text-[10px]">{uc.notes}</span>}
                          <div className="mt-0.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${(doneCount / uc.subActions.length) * 100}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {unscored.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><StickyNote size={15} /> {unscored.length} cas d'usage sans scores renseignés</p>
          <div className="flex flex-wrap gap-2">
            {unscored.map((uc) => (
              <span key={uc.id} className="text-xs bg-white border border-border rounded-lg px-3 py-1.5 text-muted">
                <span className="font-semibold text-foreground">{uc.id}</span> — {uc.title}
                {uc.notes && <span className="text-slate-400 italic ml-1">({uc.notes})</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME VIEW
// ─────────────────────────────────────────────────────────────────────────────
function ThemeView({ statuses, onToggle }: { statuses: Record<string, Status>; onToggle: (id: string) => void }) {
  const [openThemes, setOpenThemes] = useState<number[]>([1])
  const [openUseCases, setOpenUseCases] = useState<string[]>([])

  const toggleTheme = (id: number) => setOpenThemes((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  const toggleUseCase = (id: string) => setOpenUseCases((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  return (
    <div className="space-y-3">
      {themes.map((theme) => {
        const allSA = theme.useCases.flatMap((uc) => uc.subActions)
        const doneSA = allSA.filter((sa) => statuses[sa.id] === "done").length
        const inProgressSA = allSA.filter((sa) => statuses[sa.id] === "in_progress").length
        const progress = allSA.length > 0 ? Math.round((doneSA / allSA.length) * 100) : 0
        const isOpen = openThemes.includes(theme.id)

        return (
          <div key={theme.id} className={`rounded-xl border ${theme.borderClass} overflow-hidden`}>
            {/* Theme header */}
            <button
              onClick={() => toggleTheme(theme.id)}
              className={`w-full flex items-center gap-3 px-5 py-4 ${theme.bgClass} text-left hover:opacity-90 transition-opacity`}
            >
              <span className={`text-sm font-bold ${theme.colorClass}`}>{theme.id}</span>
              <div className="flex-1">
                <span className="font-semibold text-foreground text-sm">{theme.title}</span>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-white/60 overflow-hidden max-w-32">
                    <div className={`h-full rounded-full transition-all ${progress === 100 ? "bg-emerald-500" : "bg-slate-400"}`} style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs text-muted">{doneSA}/{allSA.length} sous-actions</span>
                  {inProgressSA > 0 && <span className="text-xs text-amber-600 font-medium">{inProgressSA} en cours</span>}
                </div>
              </div>
              {isOpen ? <ChevronDown size={16} className="text-muted shrink-0" /> : <ChevronRight size={16} className="text-muted shrink-0" />}
            </button>

            {/* Use cases */}
            {isOpen && (
              <div className="divide-y divide-slate-100 bg-surface">
                {theme.useCases.map((uc) => {
                  const ucDone = uc.subActions.filter((sa) => statuses[sa.id] === "done").length
                  const ucInProgress = uc.subActions.filter((sa) => statuses[sa.id] === "in_progress").length
                  const ucOpen = openUseCases.includes(uc.id)

                  return (
                    <div key={uc.id}>
                      <button
                        onClick={() => toggleUseCase(uc.id)}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-xs font-mono font-bold text-muted w-8 shrink-0">{uc.id}</span>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-foreground">{uc.title}</span>
                          {uc.notes && <span className="ml-2 text-xs text-muted italic">({uc.notes})</span>}
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <ScoreBadge label="Impact" value={uc.impact} />
                            <ScoreBadge label="Facilité" value={uc.ease} />
                            <ScoreBadge label="Confiance" value={uc.confidence} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {ucInProgress > 0 && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{ucInProgress} en cours</span>}
                          <span className="text-xs text-muted">{ucDone}/{uc.subActions.length}</span>
                          {ucOpen ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
                        </div>
                      </button>

                      {/* Sub-actions */}
                      {ucOpen && (
                        <ul className="border-t border-slate-100 divide-y divide-slate-50">
                          {uc.subActions.map((sa) => {
                            const status = statuses[sa.id] ?? "not_started"
                            const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(status) + 1) % 3]
                            return (
                              <li key={sa.id} className="flex items-start gap-3 px-5 py-3 bg-slate-50/60 hover:bg-slate-50">
                                <span className="text-[10px] font-mono text-slate-300 w-8 shrink-0 pt-0.5">{sa.id}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground">{sa.title}</p>
                                  <p className="text-xs text-muted mt-0.5 italic">{sa.benefit}</p>
                                </div>
                                <button
                                  onClick={() => onToggle(sa.id)}
                                  title={`Passer à : ${statusLabel[next]}`}
                                  className={`flex items-center gap-1.5 shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${statusBg[status]} hover:opacity-80`}
                                >
                                  <StatusIcon status={status} />
                                  {statusLabel[status]}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  const [tab, setTab] = useState<"matrice" | "themes">("themes")
  const [statuses, setStatuses] = useState<Record<string, Status>>({})

  useEffect(() => { setStatuses(loadStatuses()) }, [])

  const toggleStatus = (id: string) => {
    setStatuses((prev) => {
      const current = prev[id] ?? "not_started"
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % 3]
      const updated = { ...prev, [id]: next }
      saveStatuses(updated)
      return updated
    })
  }

  const allSAIds = themes.flatMap((t) => t.useCases.flatMap((uc) => uc.subActions.map((sa) => sa.id)))
  const done = allSAIds.filter((id) => statuses[id] === "done").length
  const inProgress = allSAIds.filter((id) => statuses[id] === "in_progress").length
  const progress = Math.round((done / TOTAL_SUB_ACTIONS) * 100)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Roadmap stratégique</h1>
        <p className="text-sm text-muted mt-1">Plan d'action — {TOTAL_USE_CASES} cas d'usage · {TOTAL_SUB_ACTIONS} sous-actions · 6 thèmes</p>
      </header>

      {/* Global stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{TOTAL_SUB_ACTIONS}</p>
          <p className="text-sm text-muted mt-1">Sous-actions total</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <p className="text-3xl font-bold text-emerald-700">{done}</p>
          <p className="text-sm text-emerald-700/70 mt-1">Terminées</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <p className="text-3xl font-bold text-amber-700">{inProgress}</p>
          <p className="text-sm text-amber-700/70 mt-1">En cours</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-3xl font-bold text-foreground">{progress}%</p>
          <p className="text-sm text-muted mt-1">Avancement global</p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("themes")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "themes" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          <List size={15} /> Par thème
        </button>
        <button
          onClick={() => setTab("matrice")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "matrice" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          <BarChart2 size={15} /> Matrice impact/facilité
        </button>
      </div>

      {tab === "themes" && <ThemeView statuses={statuses} onToggle={toggleStatus} />}
      {tab === "matrice" && <MatriceView statuses={statuses} />}
    </div>
  )
}
