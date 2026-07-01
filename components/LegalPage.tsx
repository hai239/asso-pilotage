import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

// ──────────────────────────────────────────────
// Gabarit commun aux pages légales publiques
// (mentions légales, confidentialité, accessibilité).
// Pages statiques, accessibles sans authentification, sans sidebar.
// ──────────────────────────────────────────────
const liens = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Politique de confidentialité" },
  { href: "/accessibilite", label: "Déclaration d'accessibilité" },
]

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen w-full bg-background">
      <header className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo-area.png" alt="" width={28} height={28} className="rounded-lg" />
            <span className="font-semibold text-foreground text-sm">Asso — Pilotage</span>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded"
          >
            <ArrowLeft size={15} /> Retour à l'accueil
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {updated && <p className="text-sm text-muted mt-1">Dernière mise à jour : {updated}</p>}

        <div className="legal-content mt-8 flex flex-col gap-6 text-[15px] leading-relaxed text-foreground">
          {children}
        </div>

        <nav aria-label="Pages légales" className="mt-12 pt-6 border-t border-border flex flex-wrap gap-x-6 gap-y-2">
          {liens.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-muted hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  )
}

// Sous-composants de mise en forme réutilisés par les pages
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

export function Todo({ children }: { children: React.ReactNode }) {
  return (
    <mark className="bg-amber-100 text-amber-900 rounded px-1.5 py-0.5 text-[13px] font-medium">
      [À compléter — {children}]
    </mark>
  )
}
