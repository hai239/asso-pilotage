// ──────────────────────────────────────────────────────────────
// lib/supabase/server.ts — Client Supabase côté SERVEUR (App Router).
//
// Utilisé dans les Route Handlers / Server Components pour lire la
// session depuis les cookies. En Next 16, cookies() est ASYNC.
//
// ⚠️ Toujours re-vérifier l'utilisateur via supabase.auth.getUser()
//    (revalidé côté Supabase), jamais se fier au seul getSession().
// ──────────────────────────────────────────────────────────────
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Appelé depuis un Server Component : l'écriture de cookies
            // n'est pas permise. Sans effet si le proxy rafraîchit la session.
          }
        },
      },
    },
  )
}

/** Renvoie l'utilisateur authentifié (revalidé) ou null. */
export async function getServerUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
