// ──────────────────────────────────────────────
// Auth — TYPES partagés uniquement.
//
// La logique d'authentification vit désormais dans Supabase
// (voir lib/supabase/*, lib/auth-context.tsx, lib/auth-client.ts et
// docs/explanation/adr/007-auth-supabase.md). Ce fichier ne conserve que les
// types/labels réutilisés dans toute l'app (rôles, forme de l'utilisateur).
// ──────────────────────────────────────────────

import type { ModuleKey } from "./modules"

export type Role = "super_admin" | "admin" | "formatrice" | "coordinatrice" | "benevole"

export type StatutMembre = "active" | "inactive" | "en attente"

export interface AuthUser {
  id: string
  email: string
  nom: string
  prenom: string
  // ⚠️ `role` n'est plus exposé dans l'UI (remplacé par isAdmin + modules).
  // Conservé car lu par le module Ateliers pour son sélecteur de personnes.
  role: Role
  createdAt: string
  // Champs annuaire Équipe (module Membres) — voir migration 0002.
  telephone?: string
  statut?: StatutMembre
  dateInscription?: string
  notes?: string
  // Permissions d'accès (voir migration 0003 + lib/modules.ts).
  isAdmin?: boolean
  modules?: ModuleKey[]
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin:    "Super Administratrice",
  admin:          "Administratrice",
  formatrice:     "Formatrice",
  coordinatrice:  "Coordinatrice",
  benevole:       "Bénévole",
}
