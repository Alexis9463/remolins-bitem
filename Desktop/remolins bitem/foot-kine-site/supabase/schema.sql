-- ============================================================
-- Staff Fisio Futbol — schéma de base de données Supabase (Postgres)
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  numero int,
  poste text,
  date_naissance date,
  taille int,
  poids numeric,
  telephone text,
  statut text not null default 'disponible',
  antecedents text,
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  date date not null,
  categorie text,
  texte text not null,
  auteur text not null,
  created_at timestamptz not null default now()
);

create table if not exists bilans (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  date date not null,
  type text,
  titre text,
  valeurs text,
  resultats text,
  auteur text not null,
  created_at timestamptz not null default now()
);

create table if not exists douleurs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  zone text,
  mecanisme text,
  date_debut date not null,
  intensite int,
  statut text not null default 'active',
  date_resolution date,
  description text,
  auteur text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists mesures (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  date date not null,
  poids numeric,
  masse_grasse numeric,
  notes text,
  auteur text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null,
  titre text not null,
  auteur text,
  created_at timestamptz not null default now()
);

create table if not exists session_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  minutes int not null default 0,
  rpe int not null default 0,
  poste text
);

create table if not exists journal (
  id uuid primary key default gen_random_uuid(),
  auteur text not null,
  action text not null,
  module text not null,
  cible_nom text,
  details text,
  date timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Row Level Security : seuls les comptes authentifiés du projet
-- (equip mèdic del club) poden llegir/escriure. Cap accés públic.
-- ------------------------------------------------------------
alter table players enable row level security;
alter table notes enable row level security;
alter table bilans enable row level security;
alter table douleurs enable row level security;
alter table mesures enable row level security;
alter table sessions enable row level security;
alter table session_entries enable row level security;
alter table journal enable row level security;

create policy "authenticated full access" on players for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on notes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on bilans for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on douleurs for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on mesures for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on sessions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on session_entries for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on journal for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists idx_notes_player on notes(player_id);
create index if not exists idx_bilans_player on bilans(player_id);
create index if not exists idx_douleurs_player on douleurs(player_id);
create index if not exists idx_mesures_player on mesures(player_id);
create index if not exists idx_session_entries_session on session_entries(session_id);
create index if not exists idx_session_entries_player on session_entries(player_id);
create index if not exists idx_journal_date on journal(date desc);
