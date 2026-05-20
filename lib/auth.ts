"use client"

// ──────────────────────────────────────────────
// Auth système — localStorage (pas de backend)
// ──────────────────────────────────────────────

export type Role = "admin" | "formatrice" | "coordinatrice" | "benevole"

export interface AuthUser {
  id: string
  email: string
  nom: string
  prenom: string
  role: Role
  createdAt: string
}

const STORAGE_USERS   = "asso-users"
const STORAGE_SESSION = "asso-session"

// ── Helpers ──────────────────────────────────

function hashPwd(pwd: string): string {
  // Simple hash non-cryptographique (usage démo/local uniquement)
  let h = 0
  for (let i = 0; i < pwd.length; i++) {
    h = ((h << 5) - h) + pwd.charCodeAt(i)
    h |= 0
  }
  return "h" + Math.abs(h).toString(36)
}

function loadUsers(): (AuthUser & { pwd: string })[] {
  if (typeof window === "undefined") return []
  try {
    const s = localStorage.getItem(STORAGE_USERS)
    return s ? JSON.parse(s) : []
  } catch { return [] }
}

function saveUsers(users: (AuthUser & { pwd: string })[]) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users))
}

// ── Compte admin par défaut ───────────────────

export function ensureDefaultAdmin() {
  if (typeof window === "undefined") return
  const users = loadUsers()
  if (users.find((u) => u.email === "admin@asso.fr")) return
  const admin: AuthUser & { pwd: string } = {
    id: "admin-default",
    email: "admin@asso.fr",
    nom: "Admin",
    prenom: "Super",
    role: "admin",
    createdAt: new Date().toISOString(),
    pwd: hashPwd("admin1234"),
  }
  saveUsers([...users, admin])
}

// ── Auth API ──────────────────────────────────

export function login(email: string, password: string): AuthUser | null {
  const users = loadUsers()
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.pwd === hashPwd(password))
  if (!user) return null
  const { pwd: _pwd, ...session } = user
  localStorage.setItem(STORAGE_SESSION, JSON.stringify(session))
  return session
}

export function register(data: {
  email: string; password: string; nom: string; prenom: string; role: Role
}): { ok: boolean; error?: string } {
  const users = loadUsers()
  if (users.find((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
    return { ok: false, error: "Cet email est déjà utilisé." }
  }
  const newUser: AuthUser & { pwd: string } = {
    id: Date.now().toString(),
    email: data.email,
    nom: data.nom,
    prenom: data.prenom,
    role: data.role,
    createdAt: new Date().toISOString(),
    pwd: hashPwd(data.password),
  }
  saveUsers([...users, newUser])
  const { pwd: _pwd, ...session } = newUser
  localStorage.setItem(STORAGE_SESSION, JSON.stringify(session))
  return { ok: true }
}

export function logout() {
  localStorage.removeItem(STORAGE_SESSION)
}

export function getSession(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const s = localStorage.getItem(STORAGE_SESSION)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export const ROLE_LABELS: Record<Role, string> = {
  admin:          "Administratrice",
  formatrice:     "Formatrice",
  coordinatrice:  "Coordinatrice",
  benevole:       "Bénévole",
}
