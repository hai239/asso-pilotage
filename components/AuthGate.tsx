"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import Sidebar from "./Sidebar"

const LEGAL_PATHS = ["/mentions-legales", "/confidentialite", "/accessibilite"]

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  // Pages légales publiques : accessibles sans authentification, sans sidebar.
  const isLegal = LEGAL_PATHS.includes(pathname)
  const isLogin = pathname === "/login"
  // Le tableau de bord est un "lanceur" plein écran : pas de sidebar (mais auth requise).
  const isDashboard = pathname === "/dashboard"

  useEffect(() => {
    if (loading) return
    if (!user && !isLogin && !isLegal) router.replace("/login")
    if (user  &&  isLogin) router.replace("/dashboard")
  }, [user, loading, isLogin, isLegal])

  // Pages autonomes (login, mentions/confidentialité/accessibilité) : pas de sidebar,
  // accessibles connecté·e ou non.
  if (isLegal || isLogin) {
    return <>{children}</>
  }

  // Chargement ou redirection en cours
  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen w-full">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    )
  }

  // Tableau de bord connecté → lanceur plein écran, sans sidebar
  if (isDashboard) {
    return <>{children}</>
  }

  // Connecté → sidebar + contenu
  return (
    <>
      <Sidebar />
      {children}
    </>
  )
}
