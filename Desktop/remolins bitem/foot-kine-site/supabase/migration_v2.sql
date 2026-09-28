-- ============================================================
-- Staff Fisio Futbol — migration v2
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- (à lancer APRÈS schema.sql, sur un projet déjà initialisé)
-- ============================================================

-- Photo de profil du joueur (affichée dans l'effectif à la place du numéro)
alter table players add column if not exists photo_url text;

-- Fréquence cardiaque par séance (BPM max et moyen)
alter table session_entries add column if not exists bpm_max int;
alter table session_entries add column if not exists bpm_moy int;

-- Taille au moment de la pesée (permet un calcul d'IMC précis même si la taille évolue)
alter table mesures add column if not exists taille int;

-- Pièces jointes (notes et bilans/tests) : liste de fichiers {name, path}
alter table notes add column if not exists fichiers jsonb not null default '[]'::jsonb;
alter table bilans add column if not exists fichiers jsonb not null default '[]'::jsonb;

-- ------------------------------------------------------------
-- Stockage des fichiers (Supabase Storage)
-- ------------------------------------------------------------
-- Bucket "avatars" : photos de joueurs (public en lecture — non sensible)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Bucket "documents" : pièces jointes des notes/bilans (privé — données médicales)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Politiques d'accès : uniquement le staff connecté (equip mèdic) peut écrire ;
-- les avatars sont lisibles publiquement, les documents uniquement par le staff connecté.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "avatars_auth_write" on storage.objects;
create policy "avatars_auth_write" on storage.objects for insert to authenticated with check (bucket_id = 'avatars');

drop policy if exists "avatars_auth_update" on storage.objects;
create policy "avatars_auth_update" on storage.objects for update to authenticated using (bucket_id = 'avatars');

drop policy if exists "avatars_auth_delete" on storage.objects;
create policy "avatars_auth_delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars');

drop policy if exists "documents_auth_read" on storage.objects;
create policy "documents_auth_read" on storage.objects for select to authenticated using (bucket_id = 'documents');

drop policy if exists "documents_auth_write" on storage.objects;
create policy "documents_auth_write" on storage.objects for insert to authenticated with check (bucket_id = 'documents');

drop policy if exists "documents_auth_delete" on storage.objects;
create policy "documents_auth_delete" on storage.objects for delete to authenticated using (bucket_id = 'documents');
