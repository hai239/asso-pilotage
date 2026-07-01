"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import Sidebar from "./Sidebar"

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  const isPublic = pathname === "/login"
  // Le tableau de bord est un "lanceur" plein écran : pas de sidebar.
  // Elle reste présente sur toutes les autres pages connectées.
  const isDashboard = pathname === "/dashboard"

  useEffect(() => {
    if (loading) return
    if (!user && !isPublic) router.replace("/login")
    if (user  &&  isPublic) router.replace("/dashboard")
  }, [user, loading, isPublic])

  // Page publique (login) : pas de sidebar
  if (isPublic) {
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
