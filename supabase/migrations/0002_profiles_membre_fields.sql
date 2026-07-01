-- ──────────────────────────────────────────────────────────────
-- 0002_profiles_membre_fields.sql — Champs annuaire Équipe (Membres)
-- À exécuter dans Supabase → SQL Editor (ou via CLI supabase db push).
--
-- Le module Membres (/membres) devient l'unique point de création des
-- comptes collaborateur·ices et persiste en base (auth.users + profiles).
-- On enrichit `profiles` avec les métadonnées d'annuaire qui vivaient
-- auparavant dans le localStorage `asso-membres` :
--   telephone · statut · date_inscription · notes
-- ──────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists telephone        text not null default '',
  add column if not exists statut           text not null default 'en attente',
  add column if not exists date_inscription date not null default current_date,
  add column if not exists notes            text not null default '';

-- Recrée le trigger d'inscription pour renseigner aussi les nouveaux champs
-- depuis les user_metadata passés à auth.admin.createUser().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, nom, prenom, role,
    telephone, statut, date_inscription, notes
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nom', ''),
    coalesce(new.raw_user_meta_data ->> 'prenom', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'coordinatrice'),
    coalesce(new.raw_user_meta_data ->> 'telephone', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'statut', ''), 'en attente'),
    coalesce(nullif(new.raw_user_meta_data ->> 'date_inscription', '')::date, current_date),
    coalesce(new.raw_user_meta_data ->> 'notes', '')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
