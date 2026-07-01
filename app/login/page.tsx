"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "@/lib/auth-client"
import { useAuth } from "@/lib/auth-context"

export default function LoginPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState("")
  const [busy,     setBusy]     = useState(false)

  useEffect(() => { if (!loading && user) router.replace("/dashboard") }, [user, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)

    const res = await signIn(email, password)
    if (!res.ok) {
      setError("Email ou mot de passe incorrect.")
      setBusy(false)
      return
    }
    // onAuthStateChange met à jour le contexte → l'effet ci-dessus redirige.
    router.replace("/dashboard")
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / nom */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Asso — Pilotage</h1>
          <p className="text-sm text-muted mt-1">Espace de gestion de l'association</p>
        </div>

        {/* Carte */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <h2 className="text-sm font-semibold text-foreground mb-5">Connexion</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@asso.fr"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ateliers/40 focus:border-ateliers"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Mot de passe</label>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ateliers/40 focus:border-ateliers"
              />
            </div>

            {error && (
              <p className="text-xs text-alert bg-red-50 rounded-xl px-3 py-2 border border-red-100">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 mt-1"
            >
              {busy ? "…" : "Se connecter"}
            </button>
          </form>
        </div>

        {/* Aide */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted">
            Les comptes sont créés par l'administratrice de l'association.
          </p>
        </div>
      </div>
    </div>
  )
}
