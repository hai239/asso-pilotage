-- ──────────────────────────────────────────────────────────────
-- 0001_profiles.sql — Table de profils (porte le rôle applicatif)
-- À exécuter dans Supabase → SQL Editor (ou via CLI supabase db push).
--
-- Supabase Auth gère l'identité (auth.users) mais pas les rôles métier.
-- On mappe l'ancien AuthUser (lib/auth.ts) : nom, prenom, role.
-- ──────────────────────────────────────────────────────────────

-- Rôles applicatifs (mêmes valeurs que l'ancien type Role)
do $$ begin
  create type public.app_role as enum
    ('super_admin', 'admin', 'formatrice', 'coordinatrice', 'benevole');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  nom        text not null default '',
  prenom     text not null default '',
  role       public.app_role not null default 'coordinatrice',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Chaque utilisateur lit / modifie SON profil.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Création auto du profil à chaque inscription (lit les metadata du signup).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nom, prenom, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nom', ''),
    coalesce(new.raw_user_meta_data ->> 'prenom', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'coordinatrice')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
