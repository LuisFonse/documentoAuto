-- =====================================================================
-- MIGRACION: cada usuario sube sus propios documentos
-- Ejecutar UNA vez en Supabase > SQL Editor (se puede re-ejecutar sin problema)
--
-- Que cambia:
--  * El admin solo crea/edita/bloquea usuarios (tabla clientes).
--  * Cada usuario entra con su email (el que registró el admin) y su clave,
--    completa su vehículo y sube/quita sus 3 documentos.
--  * Un usuario solo puede ver y modificar SUS datos.
--  * La ficha pública (NFC) se lee por una función, ya no hay lectura
--    anónima directa de las tablas (antes cualquiera podía listar clientes).
-- =====================================================================

-- ---------- Administradores ----------
create table if not exists public.admins (
    email text primary key
);

insert into public.admins (email)
values ('luisfonsecasantana@gmail.com')
on conflict (email) do nothing;

alter table public.admins enable row level security;
-- (sin políticas: nadie la lee por la API, solo las funciones de abajo)

create or replace function public.email_sesion()
returns text
language sql
stable
as $$
    select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.admins a
        where lower(a.email) = public.email_sesion()
    );
$$;

-- Id del cliente asociado al usuario conectado (solo si está habilitado)
create or replace function public.mi_cliente_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select c.id
    from public.clientes c
    where lower(c.email) = public.email_sesion()
      and c.habilitado = true
    limit 1;
$$;

-- ---------- Ajustes de tablas ----------
update public.clientes set email = lower(trim(email)) where email is not null;

create unique index if not exists clientes_email_unico
    on public.clientes (lower(email))
    where email is not null;

alter table public.vehiculos add column if not exists foto_path text;
alter table public.vehiculos add column if not exists foto_url text;

-- ---------- Políticas: limpiar las antiguas ----------
drop policy if exists "auth clientes all" on public.clientes;
drop policy if exists "auth vehiculos all" on public.vehiculos;
drop policy if exists "auth documentos all" on public.documentos;
drop policy if exists "anon read clientes habilitados" on public.clientes;
drop policy if exists "anon read vehiculos" on public.vehiculos;
drop policy if exists "anon read documentos" on public.documentos;

-- ---------- clientes ----------
drop policy if exists "admin clientes" on public.clientes;
create policy "admin clientes" on public.clientes
for all to authenticated
using (public.es_admin()) with check (public.es_admin());

drop policy if exists "usuario ve su cliente" on public.clientes;
create policy "usuario ve su cliente" on public.clientes
for select to authenticated
using (id = public.mi_cliente_id());

-- ---------- vehiculos ----------
drop policy if exists "admin vehiculos" on public.vehiculos;
create policy "admin vehiculos" on public.vehiculos
for all to authenticated
using (public.es_admin()) with check (public.es_admin());

drop policy if exists "usuario su vehiculo" on public.vehiculos;
create policy "usuario su vehiculo" on public.vehiculos
for all to authenticated
using (cliente_id = public.mi_cliente_id())
with check (cliente_id = public.mi_cliente_id());

-- ---------- documentos ----------
drop policy if exists "admin documentos" on public.documentos;
create policy "admin documentos" on public.documentos
for all to authenticated
using (public.es_admin()) with check (public.es_admin());

drop policy if exists "usuario sus documentos" on public.documentos;
create policy "usuario sus documentos" on public.documentos
for all to authenticated
using (
    vehiculo_id in (select v.id from public.vehiculos v where v.cliente_id = public.mi_cliente_id())
)
with check (
    tipo in ('padron', 'permiso_circulacion', 'soap')
    and vehiculo_id in (select v.id from public.vehiculos v where v.cliente_id = public.mi_cliente_id())
);

-- ---------- Storage (PDF y fotos) ----------
-- Cada usuario solo puede tocar archivos dentro de su carpeta "<id_cliente>/..."
drop policy if exists "auth storage read" on storage.objects;
drop policy if exists "auth storage insert" on storage.objects;
drop policy if exists "auth storage update" on storage.objects;
drop policy if exists "auth storage delete" on storage.objects;
drop policy if exists "anon storage read" on storage.objects;

drop policy if exists "admin storage" on storage.objects;
create policy "admin storage" on storage.objects
for all to authenticated
using (bucket_id = 'documentos-vehiculo' and public.es_admin())
with check (bucket_id = 'documentos-vehiculo' and public.es_admin());

drop policy if exists "usuario storage propio" on storage.objects;
create policy "usuario storage propio" on storage.objects
for all to authenticated
using (
    bucket_id = 'documentos-vehiculo'
    and (storage.foldername(name))[1] = public.mi_cliente_id()::text
)
with check (
    bucket_id = 'documentos-vehiculo'
    and (storage.foldername(name))[1] = public.mi_cliente_id()::text
);
-- El bucket sigue siendo público: los links de "Ver documento" funcionan igual.

-- ---------- Funciones públicas ----------
-- Ficha pública por código NFC (la usa index.html)
create or replace function public.ficha_publica(p_codigo text)
returns json
language sql
stable
security definer
set search_path = public
as $$
    select json_build_object(
        'vehiculo', json_build_object(
            'patente', v.patente,
            'modelo', v.modelo,
            'foto_url', v.foto_url
        ),
        'documentos', coalesce((
            select json_agg(json_build_object(
                'nombre', d.nombre,
                'tipo', d.tipo,
                'archivo_url', d.archivo_url,
                'vence', d.vence
            ) order by d.nombre)
            from public.documentos d
            where d.vehiculo_id = v.id
        ), '[]'::json)
    )
    from public.clientes c
    join public.vehiculos v on v.cliente_id = c.id
    where c.nfc_codigo = p_codigo
      and c.habilitado = true
    limit 1;
$$;

-- Para que solo emails registrados por el admin puedan crear su clave
create or replace function public.email_autorizado(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.clientes c
        where lower(c.email) = lower(trim(p_email))
          and c.habilitado = true
    );
$$;

revoke all on function public.ficha_publica(text) from public;
revoke all on function public.email_autorizado(text) from public;
grant execute on function public.ficha_publica(text) to anon, authenticated;
grant execute on function public.email_autorizado(text) to anon, authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.mi_cliente_id() to authenticated;
