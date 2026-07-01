#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// create-admin.mjs — Crée (ou réinitialise) un compte admin Supabase.
//
// Usage : node --env-file=.env.local scripts/create-admin.mjs [password]
// Lit NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY depuis l'env.
// ──────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.")
  process.exit(1)
}

const EMAIL    = "admin@asso.fr"
const PRENOM   = "mickael"
const NOM      = "sollier"
const ROLE     = "super_admin"
const PASSWORD = process.argv[2] || "AdminAsso2026!"

const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// Cherche un utilisateur par email (parcourt les pages).
async function findUser(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === email.toLowerCase())
    if (u) return u
    if (data.users.length < 200) break
  }
  return null
}

const existing = await findUser(EMAIL)
let userId

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nom: NOM, prenom: PRENOM, role: ROLE },
  })
  if (error) { console.error("❌ update:", error.message); process.exit(1) }
  userId = existing.id
  console.log(`↻ Compte existant mis à jour : ${EMAIL}`)
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nom: NOM, prenom: PRENOM, role: ROLE },
  })
  if (error) { console.error("❌ create:", error.message); process.exit(1) }
  userId = data.user.id
  console.log(`＋ Compte créé : ${EMAIL}`)
}

// Garantit le profil (rôle super_admin) même si le trigger a mis un défaut.
const { error: pErr } = await admin
  .from("profiles")
  .upsert({ id: userId, email: EMAIL, nom: NOM, prenom: PRENOM, role: ROLE })
if (pErr) { console.error("❌ profil:", pErr.message); process.exit(1) }

console.log(`✅ OK — rôle ${ROLE}`)
console.log(`   Email    : ${EMAIL}`)
console.log(`   Password : ${PASSWORD}`)
