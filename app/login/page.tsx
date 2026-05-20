"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { login, register, ensureDefaultAdmin, ROLE_LABELS, type Role } from "@/lib/auth"
import { useAuth } from "@/lib/auth-context"

type Mode = "login" | "register"

export default function LoginPage() {
  const router = useRouter()
  const { user, loading, refresh } = useAuth()
  const [mode, setMode] = useState<Mode>("login")

  // Form state
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [nom,      setNom]      = useState("")
  const [prenom,   setPrenom]   = useState("")
  const [role,     setRole]     = useState<Role>("coordinatrice")
  const [error,    setError]    = useState("")
  const [busy,     setBusy]     = useState(false)

  useEffect(() => { ensureDefaultAdmin() }, [])
  useEffect(() => { if (!loading && user) router.replace("/dashboard") }, [user, loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)

    await new Promise((r) => setTimeout(r, 300)) // micro-délai pour l'UX

    if (mode === "login") {
      const u = login(email, password)
      if (!u) { setError("Email ou mot de passe incorrect."); setBusy(false); return }
      refresh()
      router.replace("/dashboard")
    } else {
      if (password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères."); setBusy(false); return }
      const result = register({ email, password, nom, prenom, role })
      if (!result.ok) { setError(result.error ?? "Erreur inconnue."); setBusy(false); return }
      refresh()
      router.replace("/dashboard")
    }
    setBusy(false)
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
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError("") }}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === m ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
              >
                {m === "login" ? "Connexion" : "Inscription"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Prénom</label>
                  <input
                    required value={prenom} onChange={(e) => setPrenom(e.target.value)}
                    placeholder="Nadjat"
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ateliers/40 focus:border-ateliers"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Nom</label>
                  <input
                    required value={nom} onChange={(e) => setNom(e.target.value)}
                    placeholder="B."
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ateliers/40 focus:border-ateliers"
                  />
                </div>
              </div>
            )}

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
                placeholder={mode === "register" ? "6 caractères minimum" : "••••••••"}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ateliers/40 focus:border-ateliers"
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Rôle</label>
                <select
                  value={role} onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ateliers/40 focus:border-ateliers"
                >
                  {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
                    <option key={r} value={r}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p className="text-xs text-alert bg-red-50 rounded-xl px-3 py-2 border border-red-100">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 mt-1"
            >
              {busy ? "…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>
        </div>

        {/* Compte démo */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted">
            Compte démo : <span className="font-mono text-foreground">admin@asso.fr</span> / <span className="font-mono text-foreground">admin1234</span>
          </p>
        </div>
      </div>
    </div>
  )
}
