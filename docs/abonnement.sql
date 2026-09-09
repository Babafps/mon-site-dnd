-- =====================================================================
-- Abonnement (lot 5b) — ce qui consomme des ressources
--
-- À exécuter APRÈS docs/entitlements.sql, dont ce fichier réutilise la
-- fonction has_entitlement(). Idempotent : relancer ne casse rien.
--
-- Deux règles, toutes deux appliquées PAR LA BASE, jamais par le navigateur :
--   1. le contenu personnel ne se synchronise qu'avec un abonnement ;
--   2. les portraits ont un poids maximum, plus généreux pour les abonnés.
--
-- Dans les deux cas, le refus du serveur ne casse rien côté joueur : le
-- contenu perso continue de vivre dans le navigateur, et un portrait trop
-- lourd reste affiché localement. On ne prend jamais les données en otage,
-- on refuse seulement de payer le stockage.
-- =====================================================================

-- =====================================================================
-- 1. Contenu personnel synchronisé
-- =====================================================================
-- Une ligne PAR ENTRÉE, et non un gros bloc unique : sans ça, deux appareils
-- qui écrivent chacun leur bibliothèque complète s'écrasent l'un l'autre et
-- une classe créée sur le téléphone disparaît au prochain envoi du bureau.
create table if not exists public.homebrew_entries (
    user_id     uuid        not null references auth.users (id) on delete cascade,
    type        text        not null,      -- classes, subclasses, spells, monsters…
    entry_id    text        not null,      -- l'identifiant « perso-… »
    data        jsonb,                     -- l'entrée complète, null si supprimée
    deleted     boolean     not null default false,
    updated_at  timestamptz not null default now(),
    primary key (user_id, type, entry_id)
);

comment on table public.homebrew_entries is
    'Contenu personnel synchronisé. Réservé aux abonnés : sans abonnement, la '
    'bibliothèque reste locale et entière.';
comment on column public.homebrew_entries.deleted is
    'Pierre tombale : une suppression doit voyager, sinon l''entrée revient au '
    'prochain rapatriement depuis un autre appareil.';

create index if not exists homebrew_user_idx on public.homebrew_entries (user_id, updated_at desc);

drop trigger if exists homebrew_touch on public.homebrew_entries;
create trigger homebrew_touch
    before update on public.homebrew_entries
    for each row execute function public.touch_updated_at();

alter table public.homebrew_entries enable row level security;

-- Lecture : chacun la sienne. On lit MÊME SANS abonnement — un abonnement qui
-- s'arrête ne doit pas rendre illisible ce qui a déjà été déposé.
drop policy if exists homebrew_select_own on public.homebrew_entries;
create policy homebrew_select_own
    on public.homebrew_entries for select
    using (auth.uid() = user_id);

-- Écriture : la sienne, ET seulement avec un abonnement actif.
-- C'est ici que la règle vit. Le navigateur peut mentir tant qu'il veut.
drop policy if exists homebrew_insert_own on public.homebrew_entries;
create policy homebrew_insert_own
    on public.homebrew_entries for insert
    with check (auth.uid() = user_id and public.has_entitlement('abonnement'));

drop policy if exists homebrew_update_own on public.homebrew_entries;
create policy homebrew_update_own
    on public.homebrew_entries for update
    using (auth.uid() = user_id and public.has_entitlement('abonnement'))
    with check (auth.uid() = user_id and public.has_entitlement('abonnement'));

drop policy if exists homebrew_delete_own on public.homebrew_entries;
create policy homebrew_delete_own
    on public.homebrew_entries for delete
    using (auth.uid() = user_id and public.has_entitlement('abonnement'));

-- =====================================================================
-- 2. Quota d'images
-- =====================================================================
-- Les seules images qui atteignent le serveur sont les portraits, rangés
-- dans character_data sous la clé `dnd-avatar` (l'image source pleine
-- résolution et les fonds de page, eux, ne quittent jamais l'appareil —
-- voir DB.set dans script.js).
--
-- Les valeurs sont des URL de données en base64 : leur longueur en
-- caractères vaut environ 4/3 du poids réel du fichier.

create or replace function public.image_max_bytes()
returns integer language sql stable security definer set search_path = public as $$
    select case when public.has_entitlement('abonnement') then 2 * 1024 * 1024
                else 300 * 1024 end;
$$;

create or replace function public.image_total_bytes()
returns bigint language sql stable security definer set search_path = public as $$
    select case when public.has_entitlement('abonnement') then 20 * 1024 * 1024
                else 2 * 1024 * 1024 end;
$$;

-- Ce que ce compte occupe déjà en portraits, hors la fiche en cours d'écriture
-- (sinon on compterait deux fois la valeur qu'on est en train de remplacer).
create or replace function public.image_used_bytes(p_except uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(sum((length(d.value) * 3) / 4), 0)
    from public.character_data d
    where d.user_id = auth.uid()
      and d.key = 'dnd-avatar'
      and (p_except is null or d.character_id <> p_except);
$$;

/** Vrai si cette écriture tient dans le quota. Tout ce qui n'est pas une
    image passe sans condition : cette fonction ne doit jamais gêner
    l'enregistrement d'une fiche. */
create or replace function public.image_quota_ok(p_key text, p_value text, p_char uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select case
        when p_key is distinct from 'dnd-avatar' then true
        when p_value is null or p_value = '' then true
        when (length(p_value) * 3) / 4 > public.image_max_bytes() then false
        else public.image_used_bytes(p_char) + (length(p_value) * 3) / 4
             <= public.image_total_bytes()
    end;
$$;

revoke all on function public.image_quota_ok(text, text, uuid) from public;
grant execute on function public.image_quota_ok(text, text, uuid) to authenticated;

-- ------------------------------------------------- les politiques d'écriture
-- Comme au lot 4 : les politiques d'une même commande se combinent par OU,
-- donc laisser les anciennes en place viderait le quota de son sens. On les
-- retire et on les repose, en affichant ce qui a été enlevé.
do $$
declare pol record;
begin
    for pol in
        select policyname, cmd from pg_policies
        where schemaname = 'public' and tablename = 'character_data'
          and cmd in ('INSERT', 'UPDATE')
    loop
        raise notice 'politique % retirée sur character_data : %', pol.cmd, pol.policyname;
        execute format('drop policy %I on public.character_data', pol.policyname);
    end loop;
end $$;

create policy character_data_insert_own
    on public.character_data for insert
    with check (
        auth.uid() = user_id
        and public.image_quota_ok(key, value, character_id)
    );

create policy character_data_update_own
    on public.character_data for update
    using (auth.uid() = user_id)
    with check (
        auth.uid() = user_id
        and public.image_quota_ok(key, value, character_id)
    );

-- =====================================================================
-- Vérifications, à lire après exécution
-- =====================================================================
--   select policyname, cmd from pg_policies
--   where schemaname='public'
--     and tablename in ('characters','character_data','entitlements','homebrew_entries')
--   order by tablename, cmd;
--
-- Attendu :
--   characters        INSERT  characters_insert_own_within_quota   (+ vos SELECT/UPDATE/DELETE)
--   character_data    INSERT  character_data_insert_own
--   character_data    UPDATE  character_data_update_own
--   entitlements      SELECT  entitlements_select_own              (et RIEN d'autre)
--   homebrew_entries  SELECT/INSERT/UPDATE/DELETE  homebrew_*_own
--
-- ⚠️ Si character_data n'avait PAS de politique SELECT/DELETE, elles n'ont pas
-- été touchées : ce script ne remplace que INSERT et UPDATE. Vérifie qu'une
-- politique SELECT « auth.uid() = user_id » existe toujours, sinon la
-- synchronisation ne pourra plus rien relire.
--
-- Essayer le quota à la main (doit répondre false sur une valeur énorme) :
--   select public.image_quota_ok('dnd-avatar', repeat('x', 900000), null);
