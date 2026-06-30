"use client"

// ─────────────────────────────────────────────────────────────────────────────
//  Page Veille subventions
//
//  Vue hybride : tableau stylisé (lit le Sheet via /api/subventions-sheet)
//  ou vue iframe directe du Sheet. Édition du statut + suppression de lignes
//  via /api/subventions-sheet/update et /delete, qui relayent à un Web App
//  Apps Script (cf. lib/sheets-webapp.ts).
//
//  Toute la logique pure (parsing, formattage, couleurs) vit dans
//  lib/veille-subventions.ts ; les cellules sont dans _components/cells.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Calendar, ExternalLink, List, RotateCcw, Search, X } from "lucide-react"
import {
  EMBED_URL,
  OPEN_URL,
  STATUT_VALUES,
  formatMontant,
  resolveColumns,
  type ResolvedColumns,
  type ResponsablesResponse,
  type SheetErrorResponse,
  type SheetResponse,
  type SheetRow,
} from "@/lib/veille-subventions"
import {
  DeadlineCell,
  DeleteRowButton,
  IntituleCell,
  OrganismeCell,
  ResponsableCell,
  StatutCell,
  TypeCell,
} from "./_components/cells"

type View = "tableau" | "sheet"
type MutationError = { msg: string; hint?: string }

export default function VeilleSubventionsPage() {
  // ── State ───────────────────────────────────────────────────────────────────
  const [data, setData] = useState<SheetResponse | null>(null)
  const [error, setError] = useState<SheetErrorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>("tableau")
  const [search, setSearch] = useState("")
  const [filterStatut, setFilterStatut] = useState("")
  const [filterSource, setFilterSource] = useState("")
  const [pending, setPending] = useState<Record<string, true>>({})
  const [mutationError, setMutationError] = useState<MutationError | null>(null)
  const [responsables, setResponsables] = useState<string[]>([])

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/subventions-sheet", { cache: "no-store" })
      const body = await res.json()
      if (!res.ok) {
        setError(body as SheetErrorResponse)
        setData(null)
      } else {
        setData(body as SheetResponse)
      }
    } catch (e) {
      setError({ status: 0, error: "Erreur réseau", hint: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Liste des responsables (feuille « Responsables possibles »). Non bloquant :
  // en cas d'échec, le dropdown garde la valeur actuelle de chaque ligne.
  useEffect(() => {
    let active = true
    fetch("/api/subventions-sheet/responsables", { cache: "no-store" })
      .then((res) => res.json())
      .then((body: ResponsablesResponse) => { if (active) setResponsables(body.responsables ?? []) })
      .catch(() => { if (active) setResponsables([]) })
    return () => { active = false }
  }, [])

  // ── Derived state ───────────────────────────────────────────────────────────
  const cols = useMemo<ResolvedColumns | null>(
    () => (data ? resolveColumns(data.headers) : null),
    [data],
  )

  const sourceOptions = useMemo(() => {
    if (!data || !cols?.sourceNom) return []
    const set = new Set<string>()
    for (const r of data.rows) {
      const v = r[cols.sourceNom]
      if (v) set.add(v)
    }
    return Array.from(set).sort()
  }, [data, cols])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase().trim()
    return data.rows.filter((r) => {
      if (filterStatut && cols?.statut && r[cols.statut] !== filterStatut) return false
      if (filterSource && cols?.sourceNom && r[cols.sourceNom] !== filterSource) return false
      if (q && !Object.values(r).join(" ").toLowerCase().includes(q)) return false
      return true
    })
  }, [data, cols, search, filterStatut, filterSource])

  // ── Mutation helper (optimistic update + rollback + toast) ──────────────────
  // Factorise le pattern partagé par handleStatutChange et handleDelete :
  //   1. snapshot des rangées avant modif (rollback en cas d'échec)
  //   2. mise à jour optimiste du state local
  //   3. POST vers l'API ; en cas d'erreur → rollback + toast
  //   4. déverrouille la ligne (pending) quoi qu'il arrive
  const mutateRow = useCallback(async (
    rowId: string,
    optimisticRows: (prev: SheetRow[]) => SheetRow[],
    apiCall: () => Promise<Response>,
  ) => {
    if (!data) return
    const previousRows = data.rows
    setData({ ...data, rows: optimisticRows(previousRows) })
    setPending((p) => ({ ...p, [rowId]: true }))
    try {
      const res = await apiCall()
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setData({ ...data, rows: previousRows })
        setMutationError({ msg: body.error ?? `Erreur HTTP ${res.status}`, hint: body.hint })
      }
    } catch (e) {
      setData({ ...data, rows: previousRows })
      setMutationError({ msg: "Erreur réseau", hint: e instanceof Error ? e.message : String(e) })
    } finally {
      setPending((p) => {
        const next = { ...p }
        delete next[rowId]
        return next
      })
    }
  }, [data])

  const handleStatutChange = useCallback((rowId: string, newStatut: string, idCol: string, statutCol: string) => {
    return mutateRow(
      rowId,
      (rows) => rows.map((r) => (r[idCol] === rowId ? { ...r, [statutCol]: newStatut } : r)),
      () => fetch("/api/subventions-sheet/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId, statut: newStatut }),
      }),
    )
  }, [mutateRow])

  const handleResponsableChange = useCallback((rowId: string, newResponsable: string, idCol: string, responsableCol: string) => {
    return mutateRow(
      rowId,
      (rows) => rows.map((r) => (r[idCol] === rowId ? { ...r, [responsableCol]: newResponsable } : r)),
      () => fetch("/api/subventions-sheet/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId, responsable: newResponsable }),
      }),
    )
  }, [mutateRow])

  const handleDelete = useCallback((rowId: string, intitule: string, idCol: string) => {
    const ok = window.confirm(
      `Supprimer définitivement cette subvention ?\n\n« ${intitule || rowId} »\n\nCette action retire la ligne du Google Sheet.`,
    )
    if (!ok) return
    return mutateRow(
      rowId,
      (rows) => rows.filter((r) => r[idCol] !== rowId),
      () => fetch("/api/subventions-sheet/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId }),
      }),
    )
  }, [mutateRow])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader view={view} setView={setView} loading={loading} onRefresh={fetchData} />

      {error && <ErrorBanner title={error.error} hint={error.hint} />}
      {mutationError && (
        <ErrorBanner
          title={mutationError.msg}
          hint={mutationError.hint}
          onDismiss={() => setMutationError(null)}
        />
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-subventions rounded-full animate-spin" />
        </div>
      )}

      {view === "sheet" && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <iframe
            title="Veille subventions — Google Sheets"
            src={EMBED_URL}
            className="w-full"
            style={{ height: "75vh", border: 0 }}
          />
        </div>
      )}

      {view === "tableau" && data && cols && (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            statut={filterStatut}
            onStatutChange={setFilterStatut}
            source={filterSource}
            onSourceChange={setFilterSource}
            hasStatutCol={!!cols.statut}
            sourceOptions={sourceOptions}
            count={filtered.length}
            total={data.rows.length}
          />

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <SubventionsTable
              rows={filtered}
              cols={cols}
              pending={pending}
              responsables={responsables}
              onStatutChange={handleStatutChange}
              onResponsableChange={handleResponsableChange}
              onDelete={handleDelete}
            />
          )}

          <p className="mt-3 text-xs text-muted text-right">
            Dernier fetch : {new Date(data.fetchedAt).toLocaleString("fr-FR")}
          </p>
        </>
      )}
    </div>
  )
}

// ─── Sous-composants de mise en page ─────────────────────────────────────────

interface PageHeaderProps {
  view: View
  setView: (v: View) => void
  loading: boolean
  onRefresh: () => void
}

function PageHeader({ view, setView, loading, onRefresh }: PageHeaderProps) {
  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
      active ? "bg-subventions-light text-subventions-dark" : "text-muted hover:text-foreground"
    }`

  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-lg bg-subventions-light">
            <Search size={18} className="text-subventions-dark" />
          </span>
          <h1 className="text-2xl font-bold text-foreground">Veille subventions</h1>
        </div>
        <p className="text-sm text-muted mt-1">
          Subventions détectées automatiquement par l'agent de veille (mis à jour quotidiennement).
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div role="tablist" aria-label="Mode d'affichage" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          <button role="tab" aria-selected={view === "tableau"} onClick={() => setView("tableau")} className={tabClass(view === "tableau")}>
            <List size={14} /> Tableau
          </button>
          <button role="tab" aria-selected={view === "sheet"} onClick={() => setView("sheet")} className={tabClass(view === "sheet")}>
            <Calendar size={14} /> Vue Sheets
          </button>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          title="Recharger les données"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface text-muted hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw size={14} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>

        <a
          href={OPEN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-subventions text-white hover:bg-subventions-dark transition-colors"
        >
          <ExternalLink size={14} /> Ouvrir dans Google Sheets
        </a>
      </div>
    </header>
  )
}

interface ErrorBannerProps {
  title: string
  hint?: string
  onDismiss?: () => void
}

function ErrorBanner({ title, hint, onDismiss }: ErrorBannerProps) {
  return (
    <div role="alert" className="mb-6 bg-red-50 border border-alert/20 rounded-lg px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="text-alert shrink-0 mt-0.5" />
        <div className="text-sm flex-1">
          <p className="font-semibold text-alert">{title}</p>
          {hint && <p className="text-muted mt-1">{hint}</p>}
        </div>
        {onDismiss && (
          <button onClick={onDismiss} aria-label="Fermer" className="text-muted hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

interface FilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  statut: string
  onStatutChange: (v: string) => void
  source: string
  onSourceChange: (v: string) => void
  hasStatutCol: boolean
  sourceOptions: string[]
  count: number
  total: number
}

function FilterBar({ search, onSearchChange, statut, onStatutChange, source, onSourceChange, hasStatutCol, sourceOptions, count, total }: FilterBarProps) {
  const selectClass = "text-sm rounded-lg border border-border bg-surface px-3 py-2 focus:outline-none focus:border-subventions"
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:border-subventions"
        />
      </div>
      {hasStatutCol && (
        <select value={statut} onChange={(e) => onStatutChange(e.target.value)} aria-label="Filtrer par statut" className={selectClass}>
          <option value="">Tous les statuts</option>
          {STATUT_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {sourceOptions.length > 0 && (
        <select value={source} onChange={(e) => onSourceChange(e.target.value)} aria-label="Filtrer par source" className={selectClass}>
          <option value="">Toutes les sources</option>
          {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      <span className="text-xs text-muted ml-auto">
        {count} / {total} subvention{total > 1 ? "s" : ""}
      </span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-surface rounded-xl border border-border p-10 text-center">
      <p className="text-sm text-muted">Aucune subvention ne correspond aux filtres.</p>
    </div>
  )
}

interface SubventionsTableProps {
  rows: SheetRow[]
  cols: ResolvedColumns
  pending: Record<string, true>
  responsables: string[]
  onStatutChange: (rowId: string, newStatut: string, idCol: string, statutCol: string) => void
  onResponsableChange: (rowId: string, newResponsable: string, idCol: string, responsableCol: string) => void
  onDelete: (rowId: string, intitule: string, idCol: string) => void
}

function SubventionsTable({ rows, cols, pending, responsables, onStatutChange, onResponsableChange, onDelete }: SubventionsTableProps) {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-x-auto">
      <table className="w-full text-sm table-fixed min-w-[1040px]">
        <thead className="bg-slate-50 border-b border-border">
          <tr className="text-center">
            <Th>Intitulé</Th>
            <Th w="w-32">Organisme</Th>
            <Th w="w-20">Type</Th>
            <Th w="w-24">Montant</Th>
            <Th w="w-28" nowrap>Date limite</Th>
            <Th w="w-32">Statut</Th>
            <Th w="w-32">Responsable</Th>
            <th className="w-10 px-1 py-3" aria-label="Actions"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const rowId       = (cols.id && r[cols.id]) || ""
            const intitule    = (cols.intitule && r[cols.intitule]) || ""
            const url         = (cols.url && r[cols.url]) || ""
            const statutValue = (cols.statut && r[cols.statut]) || ""
            const responsableValue = (cols.responsable && r[cols.responsable]) || ""
            const isPending   = !!(rowId && pending[rowId])
            const canEdit     = !!(cols.statut && cols.id && rowId)
            const canEditResp = !!(cols.responsable && cols.id && rowId)
            const canDelete   = !!(cols.id && rowId)

            return (
              <tr key={rowId || i} className={`border-b border-border last:border-0 hover:bg-slate-50/50 transition-colors ${isPending ? "opacity-60" : ""}`}>
                <td className="px-3 py-3 align-top">
                  <IntituleCell intitule={intitule} url={url} secteurs={cols.secteurs ? r[cols.secteurs] : undefined} />
                </td>
                <td className="px-3 py-3 align-top">
                  <OrganismeCell raw={cols.organisme ? r[cols.organisme] : ""} />
                </td>
                <td className="px-2 py-3">
                  <TypeCell type={cols.type ? r[cols.type] : ""} />
                </td>
                <td className="px-2 py-3 whitespace-nowrap font-medium text-foreground">
                  {formatMontant(cols.montantMax ? r[cols.montantMax] : undefined)}
                </td>
                <td className="px-2 py-3 whitespace-nowrap align-top">
                  <DeadlineCell raw={cols.dateLimite ? r[cols.dateLimite] : undefined} statut={statutValue} />
                </td>
                <td className="px-2 py-3">
                  <StatutCell
                    statut={statutValue}
                    intitule={intitule}
                    pending={isPending}
                    editable={canEdit}
                    onChange={(v) => onStatutChange(rowId, v, cols.id!, cols.statut!)}
                  />
                </td>
                <td className="px-2 py-3">
                  <ResponsableCell
                    responsable={responsableValue}
                    options={responsables}
                    intitule={intitule}
                    pending={isPending}
                    editable={canEditResp}
                    onChange={(v) => onResponsableChange(rowId, v, cols.id!, cols.responsable!)}
                  />
                </td>
                <td className="px-1 py-3 text-center">
                  {canDelete && (
                    <DeleteRowButton
                      intitule={intitule || rowId}
                      pending={isPending}
                      onConfirm={() => onDelete(rowId, intitule, cols.id!)}
                    />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface ThProps {
  children: React.ReactNode
  w?: string
  nowrap?: boolean
}

function Th({ children, w, nowrap }: ThProps) {
  return (
    <th className={`${w ?? ""} px-3 py-3 font-semibold text-xs uppercase tracking-wider text-muted ${nowrap ? "whitespace-nowrap" : ""}`}>
      {children}
    </th>
  )
}
