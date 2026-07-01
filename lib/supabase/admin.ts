// ──────────────────────────────────────────────────────────────
// lib/supabase/admin.ts — Client Supabase ADMIN (service_role).
//
// ⚠️ SERVEUR UNIQUEMENT. Ne JAMAIS importer côté client : la clé
//    service_role contourne toutes les RLS. Utilisée seulement par
//    les Route Handlers d'administration (app/api/admin/*).
// ──────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant (env serveur).")
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
