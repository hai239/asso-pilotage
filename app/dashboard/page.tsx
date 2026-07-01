"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Heart, LogOut, UserCircle,
  UserCheck, BarChart2, ClipboardCheck, Euro, BookOpen, Megaphone, UserCog, Map, GraduationCap,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { ROLE_LABELS } from "@/lib/auth"

// ──────────────────────────────────────────────
// Tableau de bord "lanceur" : une carte par module (icône + libellé).
// La sidebar est masquée ici (voir AuthGate) et présente ailleurs.
// ──────────────────────────────────────────────
type ModuleCard = {
  href: string
  label: string
  sub: string
  icon: typeof Heart
  accent: string
  iconClass: string
  superAdminOnly?: boolean
}

const modules: ModuleCard[] = [
  { href: "/familles",      label: "Familles",      sub: "Bénéficiaires, paiements, docs", icon: UserCheck,      accent: "bg-familles-light",      iconClass: "text-familles-dark" },
  { href: "/assiduite",     label: "Assiduité",     sub: "Présences, décrochage",          icon: BarChart2,      accent: "bg-absences-light",     iconClass: "text-absences-dark" },
  { href: "/emargement",    label: "Émargement",    sub: "Présences par séance",           icon: ClipboardCheck, accent: "bg-ateliers-light",     iconClass: "text-ateliers-dark" },
  { href: "/finances",      label: "Finances",      sub: "Financements, inscriptions",     icon: Euro,           accent: "bg-finances-light",     iconClass: "text-finances-dark" },
  { href: "/ateliers",      label: "Ateliers",      sub: "Planning, groupes",              icon: BookOpen,       accent: "bg-ateliers-light",     iconClass: "text-ateliers-dark" },
  { href: "/positionnement", label: "Positionnement", sub: "Génération de tests",          icon: GraduationCap,  accent: "bg-positionnement-light", iconClass: "text-positionnement-dark" },
  { href: "/communication", label: "Communication", sub: "Calendrier, kanban, IA",         icon: Megaphone,      accent: "bg-communication-light", iconClass: "text-communication-dark" },
  { href: "/membres",       label: "Membres",       sub: "Annuaire équipe",                icon: UserCog,        accent: "bg-slate-100",          iconClass: "text-slate-700" },
  { href: "/roadmap",       label: "Roadmap",       sub: "Impact / facilité",              icon: Map,            accent: "bg-slate-100",          iconClass: "text-slate-700" },
  { href: "/compte",        label: "Mon compte",    sub: "Profil, comptes",                icon: UserCircle,     accent: "bg-slate-100",          iconClass: "text-slate-700" },
  { href: "/docs",          label: "Documentation", sub: "Guides, ADR",                    icon: BookOpen,       accent: "bg-slate-100",          iconClass: "text-slate-700", superAdminOnly: true },
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

  const cards = modules.filter((m) => !m.superAdminOnly || user.role === "super_admin")

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto">
      {/* En-tête : identité + déconnexion (repris de la sidebar, absente ici) */}
      <header className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-3">
          <span className="bg-brand text-white rounded-xl p-2.5 shrink-0">
            <Heart size={20} />
          </span>
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
              <span className="block text-[11px] text-muted truncate">{ROLE_LABELS[user.role]}</span>
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
      <nav aria-label="Modules" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ href, label, sub, icon: Icon, accent, iconClass }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 bg-surface border border-border rounded-2xl p-5 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent} ${iconClass}`}>
              <Icon size={22} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-foreground">{label}</span>
              <span className="block text-sm text-muted truncate">{sub}</span>
            </span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
