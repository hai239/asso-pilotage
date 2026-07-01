"use client"

// Normalise une date (ISO AAAA-MM-JJ ou FR JJ/MM/AAAA) vers le format ISO
// attendu par <input type="date">
function toISO(v?: string | null): string {
  if (!v) return ""
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const fr = s.split("/")
  if (fr.length === 3) {
    const [d, m, y] = fr
    if (d && m && y) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  return ""
}

/** Champ date avec sélecteur (calendrier) natif. Valeur émise au format ISO AAAA-MM-JJ. */
export default function DateInput({
  value,
  onChange,
  className,
}: {
  value?: string | null
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <input
      type="date"
      value={toISO(value)}
      onChange={e => onChange(e.target.value)}
      className={`w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ateliers ${className ?? ""}`}
    />
  )
}
