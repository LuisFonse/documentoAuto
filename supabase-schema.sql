-- Ejecuta este script en Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.clientes (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,
    email text,
    telefono text,
    nfc_codigo text not null unique,
    habilitado boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.vehiculos (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid not null references public.clientes(id) on delete cascade,
    patente text not null,
    modelo text not null,
    created_at timestamptz not null default now(),
    unique (cliente_id)
);

create table if not exists public.documentos (
    id uuid primary key default gen_random_uuid(),
    vehiculo_id uuid not null references public.vehiculos(id) on delete cascade,
    tipo text not null,
    nombre text not null,
    archivo_path text,
    archivo_url text,
    vence date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (vehiculo_id, tipo)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists documentos_updated_at on public.documentos;
create trigger documentos_updated_at
before update on public.documentos
for each row
execute function public.set_updated_at();

alter table public.clientes enable row level security;
alter table public.vehiculos enable row level security;
alter table public.documentos enable row level security;

-- Politicas para usuario autenticado (panel admin)
drop policy if exists "auth clientes all" on public.clientes;
create policy "auth clientes all"
on public.clientes
for all
to authenticated
using (true)
with check (true);

drop policy if exists "auth vehiculos all" on public.vehiculos;
create policy "auth vehiculos all"
on public.vehiculos
for all
to authenticated
using (true)
with check (true);

drop policy if exists "auth documentos all" on public.documentos;
create policy "auth documentos all"
on public.documentos
for all
to authenticated
using (true)
with check (true);

-- Politicas publicas para lectura por NFC (solo clientes habilitados)
drop policy if exists "anon read clientes habilitados" on public.clientes;
create policy "anon read clientes habilitados"
on public.clientes
for select
to anon
using (habilitado = true);

drop policy if exists "anon read vehiculos" on public.vehiculos;
create policy "anon read vehiculos"
on public.vehiculos
for select
to anon
using (true);

drop policy if exists "anon read documentos" on public.documentos;
create policy "anon read documentos"
on public.documentos
for select
to anon
using (true);

-- Bucket para PDF
insert into storage.buckets (id, name, public)
values ('documentos-vehiculo', 'documentos-vehiculo', true)
on conflict (id) do nothing;

-- Politicas storage para usuarios autenticados
drop policy if exists "auth storage read" on storage.objects;
create policy "auth storage read"
on storage.objects
for select
to authenticated
using (bucket_id = 'documentos-vehiculo');

drop policy if exists "auth storage insert" on storage.objects;
create policy "auth storage insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'documentos-vehiculo');

drop policy if exists "auth storage update" on storage.objects;
create policy "auth storage update"
on storage.objects
for update
to authenticated
using (bucket_id = 'documentos-vehiculo')
with check (bucket_id = 'documentos-vehiculo');

drop policy if exists "auth storage delete" on storage.objects;
create policy "auth storage delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'documentos-vehiculo');

-- Lectura anonima para abrir PDF desde la pagina cliente
drop policy if exists "anon storage read" on storage.objects;
create policy "anon storage read"
on storage.objects
for select
to anon
using (bucket_id = 'documentos-vehiculo');
