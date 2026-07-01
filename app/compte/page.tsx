"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { ROLE_LABELS, type AuthUser, type Role } from "@/lib/auth"
import {
  updateOwnProfile, updateOwnPassword,
  fetchAllUsers, adminCreateUser, adminUpdateUser, adminDeleteUser,
} from "@/lib/auth-client"
import SlideOver, { Field, Input, Select, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"
import { UserCircle, Plus, Pencil, ShieldCheck } from "lucide-react"

// ──────────────────────────────────────────────
// Formulaire profil (section Mon profil)
// ──────────────────────────────────────────────
function ProfilSection({ user, onUpdated }: {
  user: AuthUser
  onUpdated: () => void
}) {
  const [form, setForm] = useState({ prenom: user.prenom, nom: user.nom, email: user.email })
  const [pwdForm, setPwdForm] = useState({ newPwd: "", confirmPwd: "" })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function handleSaveProfil(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setSuccess("")
    const res = await updateOwnProfile({ prenom: form.prenom, nom: form.nom, email: form.email })
    if (!res.ok) { setError(res.error ?? "Erreur."); return }
    setSuccess("Profil mis à jour.")
    onUpdated()
  }

  async function handleChangePwd(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setSuccess("")
    if (!pwdForm.newPwd) { setError("Nouveau mot de passe requis."); return }
    if (pwdForm.newPwd !== pwdForm.confirmPwd) { setError("Les mots de passe ne correspondent pas."); return }
    if (pwdForm.newPwd.length < 6) { setError("Minimum 6 caractères."); return }
    const res = await updateOwnPassword(pwdForm.newPwd)
    if (!res.ok) { setError(res.error ?? "Erreur."); return }
    setPwdForm({ newPwd: "", confirmPwd: "" })
    setSuccess("Mot de passe modifié.")
  }

  return (
    <div className="space-y-6">
      {/* Avatar + identité */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-border flex items-center justify-center">
          <UserCircle size={32} className="text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-lg">{user.prenom} {user.nom}</p>
          <p className="text-sm text-muted">{user.email}</p>
          <span className="mt-1 inline-block text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {ROLE_LABELS[user.role]}
          </span>
        </div>
      </div>

      {error && <p className="text-sm text-alert bg-red-50 border border-alert/20 px-4 py-2.5 rounded-xl">{error}</p>}
      {success && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl">{success}</p>}

      {/* Modifier profil */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Informations personnelles</h3>
        <form onSubmit={handleSaveProfil} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom" required>
              <Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
            </Field>
            <Field label="Nom" required>
              <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </Field>
          </div>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </Field>
          <button type="submit" className="self-start px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors">
            Enregistrer
          </button>
        </form>
      </div>

      {/* Changer mot de passe */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Changer le mot de passe</h3>
        <form onSubmit={handleChangePwd} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nouveau mot de passe" required>
              <Input type="password" placeholder="6 caractères min." value={pwdForm.newPwd} onChange={e => setPwdForm(f => ({ ...f, newPwd: e.target.value }))} />
            </Field>
            <Field label="Confirmer" required>
              <Input type="password" placeholder="Identique" value={pwdForm.confirmPwd} onChange={e => setPwdForm(f => ({ ...f, confirmPwd: e.target.value }))} />
            </Field>
          </div>
          <button type="submit" className="self-start px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors">
            Modifier le mot de passe
          </button>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Section admin — gestion des utilisateurs
// ──────────────────────────────────────────────
const ROLES: Role[] = ["admin", "formatrice", "coordinatrice", "benevole"]

function AdminSection() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [slideOpen, setSlideOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null)
  const [form, setForm] = useState({ prenom: "", nom: "", email: "", role: "benevole" as Role, password: "" })
  const [confirmPwd, setConfirmPwd] = useState("")
  const [error, setError] = useState("")

  async function loadUsers() { setUsers(await fetchAllUsers()) }
  useEffect(() => { loadUsers() }, [])

  function openNew() {
    setEditingUser(null)
    setForm({ prenom: "", nom: "", email: "", role: "benevole", password: "" })
    setConfirmPwd("")
    setError("")
    setSlideOpen(true)
  }

  function openEdit(u: AuthUser) {
    setEditingUser(u)
    setForm({ prenom: u.prenom, nom: u.nom, email: u.email, role: u.role, password: "" })
    setConfirmPwd("")
    setError("")
    setSlideOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!editingUser) {
      // Créer
      if (!form.password) { setError("Mot de passe requis."); return }
      if (form.password !== confirmPwd) { setError("Les mots de passe ne correspondent pas."); return }
      if (form.password.length < 6) { setError("Minimum 6 caractères."); return }
      const res = await adminCreateUser({ ...form })
      if (!res.ok) { setError(res.error ?? "Erreur."); return }
    } else {
      // Modifier
      const update: Parameters<typeof adminUpdateUser>[1] = {
        prenom: form.prenom, nom: form.nom, email: form.email, role: form.role,
      }
      if (form.password) {
        if (form.password !== confirmPwd) { setError("Les mots de passe ne correspondent pas."); return }
        if (form.password.length < 6) { setError("Minimum 6 caractères."); return }
        update.password = form.password
      }
      const res = await adminUpdateUser(editingUser.id, update)
      if (!res.ok) { setError(res.error ?? "Erreur."); return }
    }
    await loadUsers()
    setSlideOpen(false)
  }

  async function handleDelete() {
    if (!editingUser) return
    const res = await adminDeleteUser(editingUser.id)
    if (!res.ok) { setError(res.error ?? "Erreur."); return }
    await loadUsers()
    setSlideOpen(false)
  }

  const roleStyle: Record<Role, string> = {
    super_admin:   "bg-slate-900 text-white",
    admin:         "bg-red-100 text-red-700",
    formatrice:    "bg-ateliers-light text-ateliers-dark",
    coordinatrice: "bg-finances-light text-finances-dark",
    benevole:      "bg-benevoles-light text-benevoles-dark",
  }

  return (
    <div className="space-y-4">
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editingUser ? `Modifier — ${editingUser.prenom} ${editingUser.nom}` : "Nouveau compte"}
        width="md"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-alert bg-red-50 border border-alert/20 px-3 py-2 rounded-lg">{error}</p>}
          <FormRow>
            <Field label="Prénom" required>
              <Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
            </Field>
            <Field label="Nom" required>
              <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </Field>
          </FormRow>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Rôle">
            <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
          <Field label={editingUser ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"} required={!editingUser}>
            <Input type="password" placeholder="6 caractères min." value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </Field>
          {(form.password || !editingUser) && (
            <Field label="Confirmer le mot de passe" required={!editingUser}>
              <Input type="password" placeholder="Identique" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
            </Field>
          )}
          <SaveButton />
          {editingUser && <DeleteButton onClick={handleDelete} label="Supprimer ce compte" />}
        </form>
      </SlideOver>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{users.length} compte{users.length > 1 ? "s" : ""}</p>
        <button onClick={openNew} className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors">
          <Plus size={14} /> Nouveau compte
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {users.map((u, i) => (
          <div key={u.id} className={`flex items-center gap-3 px-5 py-3.5 group hover:bg-slate-50 transition-colors ${i > 0 ? "border-t border-border" : ""}`}>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <UserCircle size={16} className="text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{u.prenom} {u.nom}</p>
              <p className="text-xs text-muted truncate">{u.email}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${roleStyle[u.role]}`}>
              {ROLE_LABELS[u.role]}
            </span>
            <button
              onClick={() => openEdit(u)}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-muted opacity-0 group-hover:opacity-100 transition-all"
              title="Modifier"
            >
              <Pencil size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Page principale
// ──────────────────────────────────────────────
export default function ComptePage() {
  const { user, refresh } = useAuth()

  if (!user) return null

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Mon compte</h1>
        <p className="text-sm text-muted mt-1">Gérez vos informations personnelles et vos préférences</p>
      </header>

      <div className="space-y-10">
        <ProfilSection user={user} onUpdated={refresh} />

        {(user.role === "admin" || user.role === "super_admin") && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <ShieldCheck size={18} className="text-red-600" />
              <h2 className="text-lg font-semibold text-foreground">Gestion des comptes</h2>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
            </div>
            <AdminSection />
          </section>
        )}
      </div>
    </div>
  )
}
