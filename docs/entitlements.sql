-- =====================================================================
-- Droits d'accès (lot 4) — table, RLS, quotas
--
-- À exécuter UNE FOIS dans l'éditeur SQL de Supabase.
-- Idempotent : relancer ne casse rien.
--
-- Principe : le client ne peut RIEN écrire ici. Il lit ses propres lignes,
-- c'est tout. Seule la fonction Edge `stripe-webhook`, qui utilise la clé
-- service_role, écrit — et elle n'écrit qu'après avoir vérifié la signature
-- de Stripe.
--
-- Le cosmétique peut être débloqué en trichant dans la console : ce n'est pas
-- grave, ça ne coûte rien à personne. Tout ce qui consomme des ressources
-- (nombre de fiches synchronisées, images, synchro) est appliqué ICI, dans les
-- politiques, là où le navigateur n'a pas son mot à dire.
-- =====================================================================

-- ---------------------------------------------------------------- la table
create table if not exists public.entitlements (
    id                      uuid primary key default gen_random_uuid(),
    user_id                 uuid not null references auth.users (id) on delete cascade,
    product                 text not null,
    active                  boolean not null default true,
    -- null = achat définitif ; une date = abonnement, accès jusque-là
    expires_at              timestamptz,
    source                  text not null default 'stripe',   -- stripe | manual | cadeau
    stripe_customer_id      text,
    stripe_subscription_id  text,
    stripe_event_id         text,          -- dernier événement appliqué (trace)
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now(),
    unique (user_id, product)
);

comment on table  public.entitlements is
    'Ce à quoi un compte a droit. Écrit uniquement par la fonction Edge stripe-webhook.';
comment on column public.entitlements.expires_at is
    'NULL = achat définitif. Sinon fin de la période payée (abonnement).';

create index if not exists entitlements_user_idx on public.entitlements (user_id);
create index if not exists entitlements_sub_idx  on public.entitlements (stripe_subscription_id);

-- ------------------------------------------------------- horodatage automatique
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists entitlements_touch on public.entitlements;
create trigger entitlements_touch
    before update on public.entitlements
    for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------- la RLS
alter table public.entitlements enable row level security;

-- Lecture : chacun ne voit que ses lignes.
drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own
    on public.entitlements for select
    using (auth.uid() = user_id);

-- AUCUNE politique insert / update / delete.
-- RLS activée + zéro politique d'écriture = personne n'écrit depuis le client,
-- même avec la clé publique en main. La clé service_role de la fonction Edge,
-- elle, contourne la RLS : c'est le seul chemin d'écriture.

-- ------------------------------------------------------- lecture pratique côté client
-- Une vue qui ne montre que ce qui est ACTIF MAINTENANT : le navigateur n'a pas
-- à savoir interpréter une date d'expiration, et l'heure du serveur fait foi.
-- security_invoker : la vue s'exécute avec les droits de l'appelant, donc la
-- RLS ci-dessus s'applique (sans ça, une vue rendrait les lignes de tout le monde).
drop view if exists public.my_entitlements;
create view public.my_entitlements with (security_invoker = true) as
    select product, expires_at
    from public.entitlements
    where user_id = auth.uid()
      and active
      and (expires_at is null or expires_at > now());

grant select on public.my_entitlements to authenticated;

-- =====================================================================
-- Les quotas, appliqués par la base
-- =====================================================================

-- « Ce compte a-t-il ce droit, maintenant ? »
-- security definer : la fonction doit pouvoir lire entitlements même quand
-- elle est appelée depuis la politique d'une AUTRE table.
create or replace function public.has_entitlement(p_product text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.entitlements e
        where e.user_id = auth.uid()
          and e.product = p_product
          and e.active
          and (e.expires_at is null or e.expires_at > now())
    );
$$;

revoke all on function public.has_entitlement(text) from public;
grant execute on function public.has_entitlement(text) to authenticated;

-- Nombre de fiches synchronisées offertes sans abonnement.
-- Le LOCAL reste illimité : on ne prend jamais les données en otage, seule la
-- place sur NOS serveurs est comptée.
create or replace function public.free_character_quota()
returns integer language sql immutable as $$ select 3; $$;

create or replace function public.character_quota_ok()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.has_entitlement('abonnement')
        or (
            select count(*) from public.characters c where c.user_id = auth.uid()
           ) < public.free_character_quota();
$$;

revoke all on function public.character_quota_ok() from public;
grant execute on function public.character_quota_ok() to authenticated;

-- ------------------------------------------------- la politique qui compte
-- ATTENTION : les politiques d'une même commande sont combinées par OU. Laisser
-- l'ancienne politique d'insertion en place rendrait le quota inopérant. On
-- retire donc toutes les politiques INSERT existantes sur `characters` avant de
-- poser la bonne. Les noms retirés sont affichés dans les messages.
do $$
declare pol record;
begin
    for pol in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = 'characters' and cmd = 'INSERT'
    loop
        raise notice 'politique INSERT retirée sur characters : %', pol.policyname;
        execute format('drop policy %I on public.characters', pol.policyname);
    end loop;
end $$;

create policy characters_insert_own_within_quota
    on public.characters for insert
    with check (auth.uid() = user_id and public.character_quota_ok());

-- Vérification rapide, à lire après exécution :
--   select policyname, cmd from pg_policies
--   where schemaname='public' and tablename in ('characters','entitlements')
--   order by tablename, cmd;
--
-- On doit voir, sur entitlements, UNE seule ligne, en SELECT.

-- =====================================================================
-- Donner un droit à la main (test, cadeau, geste commercial)
-- =====================================================================
-- Depuis l'éditeur SQL de Supabase, qui s'exécute en service_role :
--
--   insert into public.entitlements (user_id, product, source)
--   values ('COLLE-ICI-L-UUID-DU-COMPTE', 'des-obsidienne', 'manual')
--   on conflict (user_id, product)
--   do update set active = true, expires_at = null, source = 'manual';
--
-- Un abonnement d'essai d'un mois :
--
--   insert into public.entitlements (user_id, product, expires_at, source)
--   values ('COLLE-ICI-L-UUID', 'abonnement', now() + interval '1 month', 'manual')
--   on conflict (user_id, product)
--   do update set active = true, expires_at = excluded.expires_at, source = 'manual';
--
-- Retirer un droit :
--
--   update public.entitlements set active = false
--   where user_id = 'COLLE-ICI-L-UUID' and product = 'des-obsidienne';
