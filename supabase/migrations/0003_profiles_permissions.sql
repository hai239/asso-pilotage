-- ──────────────────────────────────────────────────────────────
-- 0003_profiles_permissions.sql — Permissions d'accès par personne
-- À exécuter dans Supabase → SQL Editor (ou via CLI supabase db push).
--
-- Remplace les rôles applicatifs par un modèle de permissions explicite :
--   • is_admin  → peut gérer les comptes et distribuer les accès (module Équipe)
--   • modules   → liste des modules accessibles dans le menu / les routes
--                 (emargement, assiduite, finances, ateliers, familles,
--                  positionnement, communication)
-- La colonne `role` est conservée (défaut 'coordinatrice') car le module
-- Ateliers la lit encore pour son sélecteur de personnes impliquées.
-- ──────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists modules  text[]  not null default '{}';

-- Backfill : ne verrouille personne. Toute personne déjà présente reçoit
-- l'accès à tous les modules ; les anciennes admin/super_admin deviennent
-- administratrices. L'administratrice pourra ensuite restreindre chaque compte.
update public.profiles
  set modules = array[
    'emargement','assiduite','finances','ateliers',
    'familles','positionnement','communication'
  ]
  where coalesce(array_length(modules, 1), 0) = 0;

update public.profiles
  set is_admin = true
  where role in ('admin', 'super_admin');
