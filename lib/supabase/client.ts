// ──────────────────────────────────────────────────────────────
// lib/supabase/client.ts — Client Supabase côté NAVIGATEUR.
//
// À utiliser dans les composants "use client" (login, contexte auth…).
// Les clés NEXT_PUBLIC_* sont publiques par design (la sécurité repose
// sur les Row Level Security policies Supabase + la session cookie).
// ──────────────────────────────────────────────────────────────
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
