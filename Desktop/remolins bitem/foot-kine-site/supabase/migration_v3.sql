-- ============================================================
-- Staff Fisio Futbol — migration v3 : Matériel (consommables)
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- (à lancer APRÈS schema.sql et migration_v2.sql)
-- ============================================================

create table if not exists materiel (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  categorie text not null default 'Altres',
  unite text not null default 'unitats',
  prix_unitaire numeric,
  seuil_alerte int not null default 0,
  stock_qte int not null default 0,
  sac_a_qte int not null default 0,
  sac_h_qte int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table materiel enable row level security;

create policy "authenticated full access" on materiel for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists idx_materiel_categorie on materiel(categorie);
