"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Heart, LogOut, UserCircle, Search,
  UserCheck, BarChart2, ClipboardCheck, BookOpen, Megaphone, UserCog, GraduationCap, StickyNote,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { moduleForPath } from "@/lib/modules"

// ──────────────────────────────────────────────
// Tableau de bord "lanceur" : une carte par module (icône + libellé).
// La sidebar est masquée ici (voir AuthGate) et présente ailleurs.
// ──────────────────────────────────────────────
type ModuleCard = {
  href: string
  label: string
  icon: typeof Heart
  accent: string
  iconClass: string
  superAdminOnly?: boolean
}

// Ordre + intitulés repris à l'identique de la section « Opérationnel » de la sidebar.
const modules: ModuleCard[] = [
  { href: "/emargement",         label: "Émargement",             icon: ClipboardCheck, accent: "bg-ateliers-light",       iconClass: "text-ateliers-dark" },
  { href: "/assiduite",          label: "Assiduité",              icon: BarChart2,      accent: "bg-absences-light",       iconClass: "text-absences-dark" },
  { href: "/veille-subventions", label: "Veille subventions",     icon: Search,         accent: "bg-subventions-light",    iconClass: "text-subventions-dark" },
  { href: "/ateliers",           label: "Ateliers",               icon: BookOpen,       accent: "bg-ateliers-light",       iconClass: "text-ateliers-dark" },
  { href: "/familles",           label: "Familles",               icon: UserCheck,      accent: "bg-familles-light",       iconClass: "text-familles-dark" },
  { href: "/positionnement",     label: "Test de positionnement", icon: GraduationCap,  accent: "bg-positionnement-light", iconClass: "text-positionnement-dark" },
  { href: "/notes",              label: "Notes",                  icon: StickyNote,     accent: "bg-positionnement-light", iconClass: "text-positionnement-dark" },
  { href: "/communication",      label: "Communication",          icon: Megaphone,      accent: "bg-communication-light",  iconClass: "text-communication-dark" },
  { href: "/membres",            label: "Équipe",                 icon: UserCog,        accent: "bg-slate-100",            iconClass: "text-slate-700" },
]

function todayFr() {
  return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  if (!user) return null

  // N'affiche que les cartes autorisées : l'Équipe si administratrice, les
  // modules selon les permissions de la personne (les pages hors périmètre
  // « modules », ex. Veille subventions, restent visibles pour tous).
  const cards = modules.filter((m) => {
    if (m.href === "/membres") return user.isAdmin === true
    const key = moduleForPath(m.href)
    return key ? (user.modules ?? []).includes(key) : true
  })

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto">
      {/* En-tête : identité + déconnexion (repris de la sidebar, absente ici) */}
      <header className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-3">
          <Image src="/logo-area.png" alt="" width={40} height={40} className="rounded-xl shrink-0" />
          <div>
            <p className="text-sm text-muted capitalize">{todayFr()}</p>
            <h1 className="text-2xl font-bold text-foreground">Bonjour {user.prenom}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/compte"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-surface border border-border hover:border-slate-300 transition-colors group"
          >
            <span className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 group-hover:bg-slate-300 transition-colors">
              <UserCircle size={17} className="text-slate-500" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground truncate">{user.prenom} {user.nom}</span>
              <span className="block text-[11px] text-muted truncate">{user.isAdmin ? "Administratrice" : "Membre de l'équipe"}</span>
            </span>
          </Link>
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-muted hover:text-foreground hover:border-slate-300 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Grille de modules */}
      <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Opérationnel</h2>
      <nav aria-label="Opérationnel" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ href, label, icon: Icon, accent, iconClass }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 bg-surface border border-border rounded-2xl p-5 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent} ${iconClass}`}>
              <Icon size={22} />
            </span>
            <span className="min-w-0 font-semibold text-foreground">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Liens légaux — le tableau de bord n'a pas de sidebar (voir AuthGate), donc pas d'autre accès */}
      <nav aria-label="Pages légales" className="mt-10 flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/mentions-legales" className="text-xs text-muted hover:text-foreground transition-colors">Mentions légales</Link>
        <Link href="/confidentialite" className="text-xs text-muted hover:text-foreground transition-colors">Confidentialité</Link>
        <Link href="/accessibilite" className="text-xs text-muted hover:text-foreground transition-colors">Accessibilité</Link>
      </nav>
    </div>
  )
}
