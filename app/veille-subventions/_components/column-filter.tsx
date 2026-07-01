"use client"

// ─────────────────────────────────────────────────────────────────────────────
//  Menu de filtre multi-sélection pour un en-tête de colonne.
//
//  Un bouton entonnoir dans l'en-tête ouvre un petit panneau à cocher listant
//  les valeurs présentes dans la colonne (+ leur nombre d'occurrences). La
//  sélection est remontée au parent via onChange (tableau de valeurs cochées).
//
//  Le panneau est en position `fixed` (ancré sous le bouton) pour ne pas être
//  rogné par l'`overflow-hidden` du conteneur du tableau.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react"
import { Filter, type LucideIcon } from "lucide-react"

export interface FilterOption {
  value: string
  label: string
  count: number
}

interface ColumnFilterMenuProps {
  title: string
  options: FilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
  /** Icône du déclencheur (par défaut l'entonnoir). Ex. ClipboardCheck pour Bilan. */
  icon?: LucideIcon
  /** Taille de l'icône du déclencheur. */
  iconSize?: number
}

const PANEL_WIDTH = 240

export function ColumnFilterMenu({ title, options, selected, onChange, icon: Icon = Filter, iconSize = 13 }: ColumnFilterMenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const active = selected.length > 0

  // Fermeture : clic extérieur, scroll, resize, Échap
  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    function close() { setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDocMouseDown)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown)
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  function toggleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      let left = r.left
      if (left + PANEL_WIDTH > window.innerWidth - 8) left = window.innerWidth - PANEL_WIDTH - 8
      setPos({ top: r.bottom + 4, left: Math.max(8, left) })
    }
    setOpen((o) => !o)
  }

  function toggleValue(v: string) {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        aria-label={`Filtrer par ${title}`}
        title={`Filtrer par ${title}`}
        className={`inline-flex items-center rounded p-0.5 transition-colors ${
          active ? "text-subventions" : "text-slate-400 hover:text-foreground"
        }`}
      >
        <Icon size={iconSize} className={active ? "fill-subventions/20" : ""} />
        {active && <span className="ml-0.5 text-[10px] font-semibold leading-none">{selected.length}</span>}
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: PANEL_WIDTH }}
          className="z-50 rounded-lg border border-border bg-surface shadow-lg text-left normal-case tracking-normal"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-foreground">{title}</span>
            {active && (
              <button type="button" onClick={() => onChange([])} className="text-[11px] text-subventions hover:underline">
                Effacer
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted">Aucune valeur</p>
            ) : (
              options.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggleValue(opt.value)}
                    className="accent-subventions shrink-0"
                  />
                  <span className="flex-1 truncate text-foreground" title={opt.label}>{opt.label}</span>
                  <span className="text-muted tabular-nums">{opt.count}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
