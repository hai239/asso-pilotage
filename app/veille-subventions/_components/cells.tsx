"use client"

// ─────────────────────────────────────────────────────────────────────────────
//  Composants de cellule du tableau Veille subventions.
//
//  Chaque cellule est purement présentationnelle : elle reçoit ses props,
//  affiche ce qu'il faut. Toute la logique de parsing/calcul est dans
//  lib/veille-subventions.ts.
//
//  Le dossier `_components` est ignoré par le router Next.js (préfixe _).
// ─────────────────────────────────────────────────────────────────────────────

import { ExternalLink, X } from "lucide-react"
import {
  STATUT_VALUES,
  daysUntil,
  deadlineBadge,
  formatDate,
  isStatutCanonique,
  parseOrganisme,
  statutBadgeClasses,
  STATUTS_AVEC_URGENCE,
} from "@/lib/veille-subventions"

// ── Intitulé + secteurs ──────────────────────────────────────────────────────

interface IntituleCellProps {
  intitule: string
  url: string
  secteurs?: string
}

export function IntituleCell({ intitule, url, secteurs }: IntituleCellProps) {
  const display = intitule || "(sans titre)"
  const titleClass = "font-medium text-foreground line-clamp-2 break-words"
  return (
    <>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={intitule}
          className={`${titleClass} hover:text-subventions-dark hover:underline`}
        >
          {display}
        </a>
      ) : (
        <span title={intitule} className={titleClass}>{display}</span>
      )}
      {secteurs && (
        <p title={secteurs} className="text-xs text-muted mt-0.5 line-clamp-1">{secteurs}</p>
      )}
    </>
  )
}

// ── Organisme (acronyme + nom complet) ────────────────────────────────────────

interface OrganismeCellProps {
  raw: string
}

export function OrganismeCell({ raw }: OrganismeCellProps) {
  if (!raw) return <span className="text-muted">—</span>
  const { acronym, name } = parseOrganisme(raw)
  if (acronym) {
    return (
      <div title={raw} className="leading-tight">
        <div className="font-semibold text-foreground text-sm">{acronym}</div>
        <div className="text-muted text-xs line-clamp-2 mt-0.5">{name}</div>
      </div>
    )
  }
  return (
    <div title={raw} className="text-muted text-sm line-clamp-3 leading-snug">{name}</div>
  )
}

// ── Type (badge gris) ─────────────────────────────────────────────────────────

interface TypeCellProps {
  type: string
}

export function TypeCell({ type }: TypeCellProps) {
  if (!type) return null
  return (
    <span
      title={type}
      className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 truncate max-w-full"
    >
      {type}
    </span>
  )
}

// ── Date limite + badge d'urgence ─────────────────────────────────────────────

interface DeadlineCellProps {
  raw: string | undefined
  statut: string
}

export function DeadlineCell({ raw, statut }: DeadlineCellProps) {
  if (!raw) return <span className="text-muted">—</span>
  // L'urgence (couleur + libellé J-X) n'a de sens que pour une subvention encore à traiter
  const showUrgency = STATUTS_AVEC_URGENCE.includes(statut)
  const badge = showUrgency ? deadlineBadge(daysUntil(raw)) : null
  return (
    <div className="leading-tight text-center">
      <div className="text-muted text-sm">{formatDate(raw)}</div>
      {badge && (
        <div className={`inline-block px-1.5 py-0.5 rounded text-xs mt-1 ${badge.cls}`}>
          {badge.label}
        </div>
      )}
    </div>
  )
}

// ── Statut (dropdown ou badge en lecture seule) ───────────────────────────────

// SVG inline encodé pour la flèche du select. Reste neutre vis-à-vis de la couleur
// du badge (utilise currentColor).
const SELECT_CHEVRON_BG =
  // eslint-disable-next-line @typescript-eslint/quotes
  "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3e%3cpath fill='currentColor' d='M0 0l4 5 4-5z'/%3e%3c/svg%3e\")"

interface StatutCellProps {
  statut: string
  intitule: string
  pending: boolean
  /** Si false → badge en lecture seule. Si true → dropdown éditable. */
  editable: boolean
  onChange: (newStatut: string) => void
}

export function StatutCell({ statut, intitule, pending, editable, onChange }: StatutCellProps) {
  const badge = statutBadgeClasses(statut)
  const isObsolete = statut && !isStatutCanonique(statut)
  const title = isObsolete
    ? `${statut} (valeur obsolète — choisis-en une nouvelle)`
    : statut

  if (!editable) {
    return statut ? (
      <span
        title={statut}
        className={`inline-block px-2 py-0.5 rounded text-xs font-medium truncate max-w-full ${badge}`}
      >
        {statut}
      </span>
    ) : null
  }

  return (
    <select
      value={statut}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Statut de ${intitule}`}
      title={title}
      className={`w-full text-xs font-medium px-2 py-0.5 rounded border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-subventions truncate ${badge} ${pending ? "cursor-wait" : ""}`}
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        paddingRight: "1.25rem",
        backgroundImage: SELECT_CHEVRON_BG,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.4rem center",
      }}
    >
      {isObsolete && <option value={statut}>⚠ {statut} (obsolète)</option>}
      {STATUT_VALUES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  )
}

// ── Responsable (dropdown ou texte en lecture seule) ──────────────────────────

interface ResponsableCellProps {
  responsable: string
  /** Liste « Prénom Nom » issue de la feuille « Responsables possibles ». */
  options: string[]
  intitule: string
  pending: boolean
  /** Si false → texte en lecture seule. Si true → dropdown éditable. */
  editable: boolean
  onChange: (newResponsable: string) => void
}

export function ResponsableCell({ responsable, options, intitule, pending, editable, onChange }: ResponsableCellProps) {
  // Valeur présente sur la ligne mais absente de la liste actuelle → obsolète
  // (responsable retiré de la feuille). On la garde sélectionnable pour ne pas
  // l'effacer par accident.
  const isObsolete = !!responsable && !options.includes(responsable)

  if (!editable) {
    return responsable ? (
      <span title={responsable} className="text-sm text-foreground truncate block">
        {responsable}
      </span>
    ) : (
      <span className="text-muted text-sm">—</span>
    )
  }

  return (
    <select
      value={responsable}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Responsable de ${intitule}`}
      title={isObsolete ? `${responsable} (absent de la liste)` : responsable || "Non assigné"}
      className={`w-full text-xs font-medium px-2 py-0.5 rounded border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-subventions truncate ${
        responsable ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-400 italic"
      } ${pending ? "cursor-wait" : ""}`}
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        paddingRight: "1.25rem",
        backgroundImage: SELECT_CHEVRON_BG,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.4rem center",
      }}
    >
      <option value="">— Non assigné —</option>
      {isObsolete && <option value={responsable}>⚠ {responsable} (absent de la liste)</option>}
      {options.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  )
}

// ── Source (lien externe) ─────────────────────────────────────────────────────
// Note : la colonne Source a été retirée du tableau, mais le composant reste
// disponible si on souhaite la réintroduire (par ex. dans une vue détail).

interface SourceLinkProps {
  name: string
  url: string
}

export function SourceLink({ name, url }: SourceLinkProps) {
  if (!name) return <span className="text-muted">—</span>
  if (!url) {
    return <span title={name} className="text-muted truncate block">{name}</span>
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={name}
      className="text-subventions-dark hover:underline flex items-center gap-1 min-w-0"
    >
      <span className="truncate">{name}</span>
      <ExternalLink size={11} className="shrink-0" />
    </a>
  )
}

// ── Bouton de suppression ─────────────────────────────────────────────────────

interface DeleteRowButtonProps {
  intitule: string
  pending: boolean
  onConfirm: () => void
}

export function DeleteRowButton({ intitule, pending, onConfirm }: DeleteRowButtonProps) {
  return (
    <button
      onClick={onConfirm}
      disabled={pending}
      title="Supprimer cette subvention"
      aria-label={`Supprimer la subvention « ${intitule} »`}
      className="p-1 rounded text-muted hover:text-alert hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-wait"
    >
      <X size={14} />
    </button>
  )
}
