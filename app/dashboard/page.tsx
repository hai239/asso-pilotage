import StatCard from "@/components/StatCard"
import { Euro, BookOpen, Megaphone, UserCog, ClipboardCheck, Users, Map } from "lucide-react"
import { finances, ateliers, communication, membres } from "@/lib/mock-data"
import Link from "next/link"

function todayFr() {
  return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

export default function DashboardPage() {
  const ateliersSallesNonConfirmees = ateliers.sessions.filter(
    (s) => s.salle === "À confirmer" && s.statut !== "terminé"
  ).length
  const ateliersCetteSemaine = ateliers.sessions.filter((s) => s.statut === "planifié").length
  const membresEnAttente = membres.liste.filter((m) => m.statut === "en attente").length

  const totalAlertes =
    finances.demandes.filter((d) => d.statut === "à compléter").length +
    ateliersSallesNonConfirmees +
    communication.calendrier.filter((p) => p.statut === "à créer").length +
    membresEnAttente

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <p className="text-sm text-muted capitalize">{todayFr()}</p>
        <h1 className="text-2xl font-bold text-foreground mt-1">Vue d'ensemble</h1>
        {totalAlertes > 0 && (
          <div className="mt-4 bg-red-50 border border-alert/20 text-alert rounded-lg px-4 py-3 text-sm font-medium">
            {totalAlertes} point{totalAlertes > 1 ? "s" : ""} à traiter aujourd'hui
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        <StatCard
          title="Finances"
          icon={Euro}
          accentClass="bg-finances-light"
          iconClass="text-finances-dark"
          borderClass="border-finances"
          alerts={finances.demandes.filter((d) => d.statut === "à compléter").length}
          href="/finances"
          cta="Gérer les financements"
          stats={[
            { label: "Demandes en cours", value: finances.stats.enCours },
            { label: "Montant total suivi", value: `${finances.stats.montantTotal.toLocaleString("fr")} €` },
            { label: "Deadline cette semaine", value: finances.stats.deadlineCetteSemaine, highlight: true },
          ]}
        />

        <StatCard
          title="Ateliers"
          icon={BookOpen}
          accentClass="bg-ateliers-light"
          iconClass="text-ateliers-dark"
          borderClass="border-ateliers"
          alerts={ateliersSallesNonConfirmees}
          href="/ateliers"
          cta="Organiser les ateliers"
          stats={[
            { label: "Ateliers planifiés", value: ateliersCetteSemaine },
            { label: "Bénéficiaires actifs", value: ateliers.beneficiaires.filter((b) => b.statut === "actif").length },
            { label: "Salle non confirmée", value: ateliersSallesNonConfirmees, highlight: ateliersSallesNonConfirmees > 0 },
          ]}
        />

        <StatCard
          title="Communication"
          icon={Megaphone}
          accentClass="bg-communication-light"
          iconClass="text-communication-dark"
          borderClass="border-communication"
          alerts={communication.calendrier.filter((p) => p.statut === "à créer").length}
          href="/communication"
          cta="Calendrier édito"
          stats={[
            { label: "Posts à créer", value: communication.calendrier.filter((p) => p.statut === "à créer").length, highlight: true },
            { label: "Brouillons", value: communication.calendrier.filter((p) => p.statut === "brouillon").length },
            { label: "Événements à venir", value: communication.evenements.length },
          ]}
        />

        <StatCard
          title="Membres"
          icon={UserCog}
          accentClass="bg-slate-100"
          iconClass="text-slate-700"
          borderClass="border-slate-300"
          alerts={membresEnAttente}
          href="/membres"
          cta="Gérer les membres"
          stats={[
            { label: "Membres actifs", value: membres.liste.filter((m) => m.statut === "active").length },
            { label: "Bénévoles", value: membres.liste.filter((m) => m.role === "benevole").length },
            { label: "Candidatures en attente", value: membresEnAttente, highlight: membresEnAttente > 0 },
          ]}
        />
      </div>

      {/* Accès rapide */}
      <div className="mt-8">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Accès rapide</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-2">
          {[
            { href: "/emargement",    label: "Émargement",    icon: ClipboardCheck, accent: "bg-ateliers-light text-ateliers-dark",           dot: "bg-ateliers" },
            { href: "/finances",      label: "Finances",      icon: Euro,           accent: "bg-finances-light text-finances-dark",           dot: "bg-finances" },
            { href: "/ateliers",      label: "Ateliers",      icon: BookOpen,       accent: "bg-ateliers-light text-ateliers-dark",           dot: "bg-ateliers" },
            { href: "/beneficiaires", label: "Bénéficiaires", icon: Users,          accent: "bg-ateliers-light text-ateliers-dark",           dot: "bg-ateliers" },
            { href: "/communication", label: "Communication", icon: Megaphone,      accent: "bg-communication-light text-communication-dark", dot: "bg-communication" },
            { href: "/membres",       label: "Membres",       icon: UserCog,        accent: "bg-slate-100 text-slate-700",                   dot: "bg-slate-500" },
            { href: "/roadmap",       label: "Roadmap",       icon: Map,            accent: "bg-slate-100 text-slate-700",                   dot: "bg-slate-500" },
          ].map(({ href, label, icon: Icon, accent }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border border-border bg-surface hover:border-slate-300 hover:shadow-sm transition-all group`}
            >
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent} group-hover:scale-110 transition-transform`}>
                <Icon size={16} />
              </span>
              <span className="text-xs font-medium text-muted group-hover:text-foreground transition-colors text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
