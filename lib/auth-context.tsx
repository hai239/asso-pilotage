"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { AuthUser, Role } from "./auth"

interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  // Reconstruit l'AuthUser depuis la session Supabase + le profil (rôle).
  const refresh = useCallback(async () => {
    const { data: { user: sUser } } = await supabase.auth.getUser()
    if (!sUser) {
      setUser(null)
      setLoading(false)
      return
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, nom, prenom, role, created_at")
      .eq("id", sUser.id)
      .single()

    setUser({
      id: sUser.id,
      email: sUser.email ?? profile?.email ?? "",
      nom: profile?.nom ?? "",
      prenom: profile?.prenom ?? "",
      role: (profile?.role ?? "coordinatrice") as Role,
      createdAt: profile?.created_at ?? sUser.created_at ?? "",
    })
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    refresh()
    // Met à jour l'utilisateur à chaque connexion / déconnexion / refresh token.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { refresh() })
    return () => subscription.unsubscribe()
  }, [refresh, supabase])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [supabase])

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
