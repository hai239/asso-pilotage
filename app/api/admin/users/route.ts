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

// Garde : renvoie le client admin si l'appelant est administratrice, sinon une erreur.
async function requireAdmin() {
  const caller = await getServerUser()
  if (!caller) {
    return { error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) }
  }
  const admin = createAdminClient()
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", caller.id).single()
  if (!prof || prof.is_admin !== true) {
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
    .select("id, email, nom, prenom, role, created_at, telephone, statut, date_inscription, notes, is_admin, modules")
    .order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const users: AuthUser[] = (data ?? []).map((p) => ({
    id: p.id, email: p.email ?? "", nom: p.nom ?? "", prenom: p.prenom ?? "",
    role: p.role as Role, createdAt: p.created_at ?? "",
    telephone: p.telephone ?? "",
    statut: (p.statut ?? "en attente") as AuthUser["statut"],
    dateInscription: p.date_inscription ?? "",
    notes: p.notes ?? "",
    isAdmin: p.is_admin === true,
    modules: (p.modules ?? []) as AuthUser["modules"],
  }))
  return NextResponse.json(users)
}

// POST — créer un compte
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if ("error" in guard) return guard.error
  const { email, password, nom, prenom, telephone, statut, dateInscription, notes, isAdmin, modules } = await request.json()
  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 })
  }
  // Le trigger public.handle_new_user crée le profil de base depuis les
  // user_metadata (role → défaut 'coordinatrice').
  const { data: created, error } = await guard.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nom: nom ?? "", prenom: prenom ?? "",
      telephone: telephone ?? "", statut: statut ?? "en attente",
      date_inscription: dateInscription ?? "", notes: notes ?? "",
    },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Permissions (is_admin + modules) : renseignées explicitement après création.
  if (created?.user?.id) {
    const { error: pErr } = await guard.admin
      .from("profiles")
      .update({ is_admin: isAdmin === true, modules: Array.isArray(modules) ? modules : [] })
      .eq("id", created.user.id)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

// PATCH — modifier un compte { id, prenom?, nom?, email?, role?, password? }
export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin()
  if ("error" in guard) return guard.error
  const { id, prenom, nom, email, password, telephone, statut, dateInscription, notes, isAdmin, modules } = await request.json()
  if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 })

  // 1) Table profiles (état civil + annuaire + permissions)
  const profilePatch: Record<string, unknown> = {}
  if (prenom !== undefined) profilePatch.prenom = prenom
  if (nom !== undefined) profilePatch.nom = nom
  if (email !== undefined) profilePatch.email = email
  if (telephone !== undefined) profilePatch.telephone = telephone
  if (statut !== undefined) profilePatch.statut = statut
  if (dateInscription !== undefined) profilePatch.date_inscription = dateInscription
  if (notes !== undefined) profilePatch.notes = notes
  if (isAdmin !== undefined) profilePatch.is_admin = isAdmin === true
  if (modules !== undefined) profilePatch.modules = Array.isArray(modules) ? modules : []
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
