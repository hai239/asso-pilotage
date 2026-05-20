"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { AuthUser, getSession, logout as authLogout, ensureDefaultAdmin } from "./auth"

interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  refresh: () => void
  logout: () => void
}

const AuthContext = createContext<AuthCtx>({ user: null, loading: true, refresh: () => {}, logout: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  function refresh() {
    ensureDefaultAdmin()
    setUser(getSession())
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  function logout() {
    authLogout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
