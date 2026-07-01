"use client"

// ──────────────────────────────────────────────────────────────
// lib/auth-client.ts — Helpers d'auth côté client (Supabase).
//
// - Connexion + self-service (profil / mot de passe) : client Supabase direct.
// - Gestion des comptes (admin) : via la route serveur /api/admin/users
//   (qui seule détient la clé service_role).
// ──────────────────────────────────────────────────────────────
import { createClient } from "@/lib/supabase/client"
import type { AuthUser, Role } from "./auth"

type Result = { ok: boolean; error?: string }

// ── Connexion ─────────────────────────────────────────────────
export async function signIn(email: string, password: string): Promise<Result> {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? { ok: false, error: error.message } : { ok: true }
}

// ── Self-service ──────────────────────────────────────────────
export async function updateOwnProfile(fields: { prenom: string; nom: string; email: string }): Promise<Result> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Non authentifié." }

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ prenom: fields.prenom, nom: fields.nom, email: fields.email })
    .eq("id", user.id)
  if (pErr) return { ok: false, error: pErr.message }

  if (fields.email && fields.email !== user.email) {
    const { error: eErr } = await supabase.auth.updateUser({ email: fields.email })
    if (eErr) return { ok: false, error: eErr.message }
  }
  return { ok: true }
}

export async function updateOwnPassword(newPwd: string): Promise<Result> {
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({ password: newPwd })
  return error ? { ok: false, error: error.message } : { ok: true }
}

// ── Administration (route serveur) ────────────────────────────
export async function fetchAllUsers(): Promise<AuthUser[]> {
  const res = await fetch("/api/admin/users")
  if (!res.ok) return []
  return res.json()
}

export async function adminCreateUser(data: {
  email: string; password: string; nom: string; prenom: string; role: Role
}): Promise<Result> {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const j = await res.json().catch(() => ({}))
  return res.ok ? { ok: true } : { ok: false, error: j.error ?? "Erreur." }
}

export async function adminUpdateUser(id: string, data: {
  prenom?: string; nom?: string; email?: string; role?: Role; password?: string
}): Promise<Result> {
  const res = await fetch("/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  })
  const j = await res.json().catch(() => ({}))
  return res.ok ? { ok: true } : { ok: false, error: j.error ?? "Erreur." }
}

export async function adminDeleteUser(id: string): Promise<Result> {
  const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, { method: "DELETE" })
  const j = await res.json().catch(() => ({}))
  return res.ok ? { ok: true } : { ok: false, error: j.error ?? "Erreur." }
}
