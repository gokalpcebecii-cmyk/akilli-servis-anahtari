-- Boş (Supabase dışı) bir PostgreSQL'e geri yükleme için asgari Supabase iskeleti.
-- Gerçek bir Supabase projesine geri yüklerken BU DOSYA ÇALIŞTIRILMAZ (roller, auth ve extensions zaten vardır).
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $$;
create schema if not exists extensions;
create schema if not exists auth;
grant usage on schema public, extensions, auth to anon, authenticated, service_role;
do $x$ begin execute format($q$alter database %I set search_path = "$user", public, extensions$q$, current_database()); end $x$;
set search_path = "$user", public, extensions;
create table if not exists auth.users (
instance_id uuid,
id uuid not null primary key,
aud character varying(255),
role character varying(255),
email character varying(255),
encrypted_password character varying(255),
email_confirmed_at timestamp with time zone,
invited_at timestamp with time zone,
confirmation_token character varying(255),
confirmation_sent_at timestamp with time zone,
recovery_token character varying(255),
recovery_sent_at timestamp with time zone,
email_change_token_new character varying(255),
email_change character varying(255),
email_change_sent_at timestamp with time zone,
last_sign_in_at timestamp with time zone,
raw_app_meta_data jsonb,
raw_user_meta_data jsonb,
is_super_admin boolean,
created_at timestamp with time zone,
updated_at timestamp with time zone,
phone text default NULL::character varying,
phone_confirmed_at timestamp with time zone,
phone_change text default ''::character varying,
phone_change_token character varying(255) default ''::character varying,
phone_change_sent_at timestamp with time zone,
confirmed_at timestamp with time zone generated always as (LEAST(email_confirmed_at, phone_confirmed_at)) stored,
email_change_token_current character varying(255) default ''::character varying,
email_change_confirm_status smallint default 0,
banned_until timestamp with time zone,
reauthentication_token character varying(255) default ''::character varying,
reauthentication_sent_at timestamp with time zone,
is_sso_user boolean default false not null,
deleted_at timestamp with time zone,
is_anonymous boolean default false not null
);
create table if not exists auth.identities (
provider_id text not null,
user_id uuid not null references auth.users(id) on delete cascade,
identity_data jsonb not null,
provider text not null,
last_sign_in_at timestamp with time zone,
created_at timestamp with time zone,
updated_at timestamp with time zone,
email text generated always as (lower((identity_data ->> 'email'::text))) stored,
id uuid default gen_random_uuid() not null primary key
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $f$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $f$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $f$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), ''))::jsonb $f$;
CREATE OR REPLACE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $f$
  select coalesce(nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'))::text $f$;
grant execute on function auth.uid(), auth.role(), auth.jwt(), auth.email() to anon, authenticated, service_role;
-- Supabase'in public şemasındaki varsayılan yetkileri (migration'lardaki revoke'lar bunların üzerine çalışır).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
-- Test iskeletine eklenen asgari Supabase Storage + uzantılar (yalnız yerel test).
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
  id text primary key, name text not null, owner uuid, owner_id text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text,
  owner uuid, owner_id text, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $f$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $f$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
