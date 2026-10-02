-- Claves de OpenAI por cliente. El secreto no se puede leer con la sesión del navegador:
-- authenticated no tiene SELECT sobre secret. Solo la service role lo lee, desde el servidor.

insert into public.permissions (slug, name, description, sort_order)
values (
  'integrations.manage',
  'Claves de OpenAI',
  'Cargar claves del cliente y elegir cuál usa cada proyecto',
  130
)
on conflict (slug) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.slug = 'integrations.manage'
where r.slug in ('super_admin', 'client_admin')
on conflict do nothing;

create table public.client_openai_keys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  key_hint text not null,
  secret text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index client_openai_keys_name_unique
  on public.client_openai_keys (client_id, lower(name));

create table public.project_ai_settings (
  project_id uuid primary key references public.projects (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  openai_key_id uuid references public.client_openai_keys (id) on delete set null,
  similarity_threshold numeric(3,2),
  updated_at timestamptz not null default now(),
  constraint project_ai_similarity_range check (
    similarity_threshold is null
    or (similarity_threshold >= 0 and similarity_threshold <= 1)
  )
);

alter table public.client_openai_keys enable row level security;
alter table public.project_ai_settings enable row level security;

create or replace function public.enforce_openai_key_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger client_openai_keys_scope
  before insert or update on public.client_openai_keys
  for each row execute function public.enforce_openai_key_scope();

create or replace function public.enforce_project_ai_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
begin
  select client_id into v_client from public.projects where id = new.project_id;
  if v_client is null then
    raise exception 'Proyecto inválido';
  end if;
  new.client_id := v_client;
  new.updated_at := now();

  if new.openai_key_id is not null and not exists (
    select 1
    from public.client_openai_keys k
    where k.id = new.openai_key_id
      and k.client_id = v_client
  ) then
    raise exception 'La clave no pertenece a este cliente';
  end if;

  return new;
end;
$$;

create trigger project_ai_scope
  before insert or update on public.project_ai_settings
  for each row execute function public.enforce_project_ai_scope();

create policy openai_keys_select on public.client_openai_keys
  for select to authenticated
  using (
    public.is_super_admin()
    or public.has_client_permission(client_id, 'integrations.manage')
  );

create policy openai_keys_insert on public.client_openai_keys
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.has_client_permission(client_id, 'integrations.manage')
  );

create policy openai_keys_delete on public.client_openai_keys
  for delete to authenticated
  using (
    public.is_super_admin()
    or public.has_client_permission(client_id, 'integrations.manage')
  );

create policy project_ai_select on public.project_ai_settings
  for select to authenticated
  using (public.has_permission(project_id, 'knowledge.read') or public.has_permission(project_id, 'projects.read'));

create policy project_ai_insert on public.project_ai_settings
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.has_client_permission(client_id, 'integrations.manage')
  );

create policy project_ai_update on public.project_ai_settings
  for update to authenticated
  using (
    public.is_super_admin()
    or public.has_client_permission(client_id, 'integrations.manage')
  )
  with check (
    public.is_super_admin()
    or public.has_client_permission(client_id, 'integrations.manage')
  );

revoke all on public.client_openai_keys from public, anon, authenticated;
revoke all on public.project_ai_settings from public, anon, authenticated;

grant select (id, client_id, name, key_hint, created_at, updated_at),
      insert (client_id, name, key_hint, secret),
      delete
  on public.client_openai_keys to authenticated;

grant select, insert, update on public.project_ai_settings to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select (id, client_id, secret) on public.client_openai_keys to service_role;
  end if;
end $$;
