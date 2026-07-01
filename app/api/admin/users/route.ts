// ──────────────────────────────────────────────────────────────
// /api/admin/users — Gestion des comptes (admin / super_admin).
//
// Toutes les opérations passent par le compte de service (service_role) et
// sont gardées côté serveur : l'appelant doit être authentifié ET avoir un
// rôle admin/super_admin. Les rôles vivent dans la table `profiles`.
// ──────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server"
import { getServerUser } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { AuthUser, Role } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Garde : renvoie le client admin si l'appelant est admin, sinon une erreur.
async function requireAdmin() {
  const caller = await getServerUser()
  if (!caller) {
    return { error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) }
  }
  const admin = createAdminClient()
  const { data: prof } = await admin.from("profiles").select("role").eq("id", caller.id).single()
  if (!prof || (prof.role !== "admin" && prof.role !== "super_admin")) {
    return { error: NextResponse.json({ error: "Accès refusé." }, { status: 403 }) }
  }
  return { admin }
}

// GET — liste des comptes (profils)
export async function GET() {
  const guard = await requireAdmin()
  if ("error" in guard) return guard.error
  const { data, error } = await guard.admin
    .from("profiles")
    .select("id, email, nom, prenom, role, created_at")
    .order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const users: AuthUser[] = (data ?? []).map((p) => ({
    id: p.id, email: p.email ?? "", nom: p.nom ?? "", prenom: p.prenom ?? "",
    role: p.role as Role, createdAt: p.created_at ?? "",
  }))
  return NextResponse.json(users)
}

// POST — créer un compte
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if ("error" in guard) return guard.error
  const { email, password, nom, prenom, role } = await request.json()
  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 })
  }
  // Le trigger public.handle_new_user crée le profil depuis les user_metadata.
  const { error } = await guard.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nom: nom ?? "", prenom: prenom ?? "", role: role ?? "benevole" },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// PATCH — modifier un compte { id, prenom?, nom?, email?, role?, password? }
export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin()
  if ("error" in guard) return guard.error
  const { id, prenom, nom, email, role, password } = await request.json()
  if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 })

  // 1) Table profiles (rôle + état civil)
  const profilePatch: Record<string, unknown> = {}
  if (prenom !== undefined) profilePatch.prenom = prenom
  if (nom !== undefined) profilePatch.nom = nom
  if (email !== undefined) profilePatch.email = email
  if (role !== undefined) profilePatch.role = role
  if (Object.keys(profilePatch).length > 0) {
    const { error } = await guard.admin.from("profiles").update(profilePatch).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // 2) auth.users (email de connexion + mot de passe)
  const authPatch: { email?: string; password?: string } = {}
  if (email) authPatch.email = email
  if (password) authPatch.password = password
  if (Object.keys(authPatch).length > 0) {
    const { error } = await guard.admin.auth.admin.updateUserById(id, authPatch)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE — supprimer un compte ?id=...
export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin()
  if ("error" in guard) return guard.error
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 })
  // profiles a un ON DELETE CASCADE sur auth.users → le profil part avec.
  const { error } = await guard.admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
