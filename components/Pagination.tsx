"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100]
const DEFAULT_PAGE_SIZE = 10

/**
 * Pagination client-side d'une liste déjà filtrée/triée.
 * `storageKey` mémorise le nombre de lignes par page choisi (par page appelante).
 */
export function usePagination<T>(items: T[], storageKey: string) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  useEffect(() => {
    const stored = Number(localStorage.getItem(storageKey))
    if (PAGE_SIZE_OPTIONS.includes(stored)) setPageSize(stored)
  }, [storageKey])

  // Revient en page 1 quand le résultat filtré change de taille (nouvelle recherche…).
  useEffect(() => { setPage(1) }, [items.length])

  function changePageSize(size: number) {
    setPageSize(size)
    setPage(1)
    localStorage.setItem(storageKey, String(size))
  }

  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return { page: currentPage, setPage, pageSize, changePageSize, total, totalPages, pageItems }
}

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  /** Classe de focus du sélecteur, pour matcher la couleur du module appelant. */
  accentClass?: string
}

export default function Pagination({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange, accentClass = "focus:ring-2 focus:ring-slate-300" }: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const btn = "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted"

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Afficher
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Résultats par page"
            className={`rounded-lg border border-border bg-surface px-2 py-1 text-xs focus:outline-none ${accentClass}`}
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          par page
        </label>
        <span className="text-xs text-muted tabular-nums">{start}–{end} sur {total}</span>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" className={btn} onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            <ChevronLeft size={14} /> Précédent
          </button>
          <span className="text-xs text-muted tabular-nums px-1">Page {page} / {totalPages}</span>
          <button type="button" className={btn} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
            Suivant <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
