-- Panel multi-tenant de base de conocimiento.
-- El aislamiento entre clientes vive en la base: RLS, triggers de alcance
-- y funciones que solo miran auth.uid(). La service role no se usa para leer datos.
-- Las funciones de autorización son security definer para no reentrar en RLS.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  -- platform: toda la plataforma. client: un cliente. project: un proyecto.
  scope text not null check (scope in ('platform', 'client', 'project')),
  allows_permission_overrides boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Permisos que un administrador puede otorgar por membresía, además del rol.
create table public.permission_override_allowlist (
  permission_id uuid primary key references public.permissions (id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index clients_name_unique on public.clients (lower(name));

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index projects_client_name_unique on public.projects (client_id, lower(name));
create index projects_client_id_idx on public.projects (client_id);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_unique on public.profiles (lower(email));

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  role_id uuid not null references public.roles (id),
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index memberships_scope_unique
  on public.memberships (user_id, client_id, project_id) nulls not distinct;

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_client_id_idx on public.memberships (client_id);
create index memberships_project_id_idx on public.memberships (project_id);

create table public.membership_permission_overrides (
  membership_id uuid not null references public.memberships (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  granted boolean not null,
  primary key (membership_id, permission_id)
);

-- ---------------------------------------------------------------------------
-- Contenido. client_id se copia del proyecto en un trigger.
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  description text not null default '',
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_project_name_unique on public.categories (project_id, lower(name));
create index categories_project_id_idx on public.categories (project_id);
create index categories_client_id_idx on public.categories (client_id);

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  title text not null,
  question text not null,
  answer text not null,
  keywords text[] not null default '{}',
  active boolean not null default true,
  priority text not null default 'normal' check (priority in ('normal', 'high', 'critical')),
  allow_ai_rewrite boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_items_project_id_idx on public.knowledge_items (project_id);
create index knowledge_items_client_id_idx on public.knowledge_items (client_id);
create index knowledge_items_category_id_idx on public.knowledge_items (category_id);
create index knowledge_items_keywords_idx on public.knowledge_items using gin (keywords);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_project_created_idx
  on public.activity_logs (project_id, created_at desc);
create index activity_logs_client_created_idx
  on public.activity_logs (client_id, created_at desc);

-- Embeddings listos para la búsqueda semántica. Dimensión 1536
-- (text-embedding-3-small / ada-002). Otro modelo exige una columna nueva.
create table public.knowledge_item_embeddings (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id uuid not null references public.knowledge_items (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  embedding extensions.vector(1536),
  model text,
  content_hash text,
  created_at timestamptz not null default now(),
  unique (knowledge_item_id, model)
);

create index knowledge_item_embeddings_project_idx
  on public.knowledge_item_embeddings (project_id);
create index knowledge_item_embeddings_embedding_idx
  on public.knowledge_item_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

-- Configuración futura por proyecto. Sin UI en esta etapa.
-- access_token_ref apunta a un secreto (Vault u otro). No guardar el token en claro.
create table public.project_whatsapp_settings (
  project_id uuid primary key references public.projects (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  phone_number_id text,
  whatsapp_business_account_id text,
  access_token_ref text,
  templates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_reservation_settings (
  project_id uuid primary key references public.projects (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  provider_key text not null check (
    provider_key in ('external_api', 'mysql', 'postgresql', 'sqlserver', 'custom')
  ),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Semilla de roles y permisos
-- ---------------------------------------------------------------------------

insert into public.permissions (slug, name, description, sort_order) values
  ('clients.read', 'Ver clientes', 'Listar clientes de la plataforma', 10),
  ('clients.write', 'Editar clientes', 'Crear y editar clientes', 20),
  ('projects.read', 'Ver proyectos', 'Listar proyectos visibles', 30),
  ('projects.write', 'Editar proyectos', 'Crear y editar proyectos', 40),
  ('users.read', 'Ver usuarios', 'Listar usuarios del alcance propio', 50),
  ('users.manage', 'Administrar usuarios', 'Invitar, asignar y desactivar usuarios', 60),
  ('roles.manage', 'Administrar roles', 'Editar los permisos de los roles', 70),
  ('categories.read', 'Ver categorías', 'Consultar categorías del proyecto', 80),
  ('categories.write', 'Editar categorías', 'Crear y editar categorías', 90),
  ('knowledge.read', 'Ver conocimiento', 'Consultar la base de conocimiento', 100),
  ('knowledge.write', 'Editar conocimiento', 'Crear y editar contenido', 110),
  ('activity.read', 'Ver actividad', 'Consultar el registro de actividad', 120);

insert into public.roles (slug, name, description, scope, allows_permission_overrides, sort_order) values
  ('super_admin', 'Super admin', 'Administra toda la plataforma.', 'platform', false, 10),
  ('client_admin', 'Administrador de cliente', 'Administra un cliente y sus proyectos.', 'client', false, 20),
  ('editor', 'Editor', 'Carga y edita el conocimiento de los proyectos asignados.', 'project', true, 30),
  ('operator', 'Operador', 'Consulta el proyecto. Las conversaciones se agregan después.', 'project', false, 40),
  ('viewer', 'Solo lectura', 'Consulta la información sin modificarla.', 'project', false, 50);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  r.slug = 'super_admin'
  or (r.slug = 'client_admin' and p.slug in (
    'projects.read', 'users.read', 'users.manage',
    'categories.read', 'categories.write',
    'knowledge.read', 'knowledge.write', 'activity.read'
  ))
  or (r.slug = 'editor' and p.slug in (
    'projects.read', 'categories.read', 'knowledge.read', 'knowledge.write'
  ))
  or (r.slug = 'operator' and p.slug in ('categories.read', 'knowledge.read'))
  or (r.slug = 'viewer' and p.slug in ('projects.read', 'categories.read', 'knowledge.read'));

insert into public.permission_override_allowlist (permission_id)
select id from public.permissions where slug = 'categories.write';

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create or replace function public.normalize_text(input text)
returns text
language sql
immutable
as $$
  select replace(replace(lower(translate(coalesce(input, ''),
    'ÁÉÍÓÚÜÑáéíóúüñ',
    'AEIOUUNaeiouun'
  )), '%', ''), '_', '');
$$;

create or replace function public.effective_permissions(p_membership_id uuid)
returns table (slug text)
language sql
stable
security definer
set search_path = public
as $$
  select perm.slug
  from public.memberships m
  join public.role_permissions rp on rp.role_id = m.role_id
  join public.permissions perm on perm.id = rp.permission_id
  where m.id = p_membership_id
    and not exists (
      select 1
      from public.membership_permission_overrides o
      where o.membership_id = m.id
        and o.permission_id = perm.id
        and o.granted = false
    )
  union
  select perm.slug
  from public.membership_permission_overrides o
  join public.permissions perm on perm.id = o.permission_id
  where o.membership_id = p_membership_id
    and o.granted = true;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    join public.profiles p on p.id = m.user_id
    where m.user_id = auth.uid()
      and m.active
      and p.status = 'active'
      and r.scope = 'platform'
      and r.slug = 'super_admin'
      and m.client_id is null
      and m.project_id is null
  );
$$;

create or replace function public.has_platform_permission(permission_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    join public.profiles p on p.id = m.user_id
    cross join lateral public.effective_permissions(m.id) ep
    where m.user_id = auth.uid()
      and m.active
      and p.status = 'active'
      and m.client_id is null
      and m.project_id is null
      and r.scope = 'platform'
      and ep.slug = permission_slug
  );
$$;

create or replace function public.has_client_permission(target_client uuid, permission_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_platform_permission(permission_slug)
    or exists (
      select 1
      from public.memberships m
      join public.profiles p on p.id = m.user_id
      cross join lateral public.effective_permissions(m.id) ep
      where m.user_id = auth.uid()
        and m.active
        and p.status = 'active'
        and m.client_id = target_client
        and ep.slug = permission_slug
    );
$$;

create or replace function public.has_project_access(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.projects pr
      join public.memberships m
        on m.user_id = auth.uid()
       and m.active
      join public.profiles p on p.id = m.user_id and p.status = 'active'
      where pr.id = target_project
        and (
          m.project_id = pr.id
          or (m.project_id is null and m.client_id = pr.client_id)
        )
    );
$$;

create or replace function public.has_permission(target_project uuid, permission_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects pr
    join public.memberships m
      on m.user_id = auth.uid()
     and m.active
    join public.profiles p on p.id = m.user_id and p.status = 'active'
    join public.roles r on r.id = m.role_id
    cross join lateral public.effective_permissions(m.id) ep
    where pr.id = target_project
      and ep.slug = permission_slug
      and (
        (m.client_id is null and m.project_id is null and r.scope = 'platform')
        or m.project_id = pr.id
        or (m.project_id is null and m.client_id = pr.client_id)
      )
  );
$$;

create or replace function public.has_client_access(target_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.memberships m
      join public.profiles p on p.id = m.user_id
      where m.user_id = auth.uid()
        and m.active
        and p.status = 'active'
        and m.client_id = target_client
    );
$$;

create or replace function public.can_write_membership(target_client uuid, target_role uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope text;
begin
  select scope into v_scope from public.roles where id = target_role;
  if v_scope is null then
    return false;
  end if;
  if public.is_super_admin() then
    return true;
  end if;
  if v_scope = 'platform' then
    return false;
  end if;
  return target_client is not null
    and public.has_client_permission(target_client, 'users.manage');
end;
$$;

create or replace function public.can_read_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1
      from public.memberships theirs
      where theirs.user_id = target
        and theirs.client_id is not null
        and public.has_client_permission(theirs.client_id, 'users.read')
    );
$$;

create or replace function public.can_update_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or target = auth.uid()
    or exists (
      select 1
      from public.memberships theirs
      where theirs.user_id = target
        and theirs.client_id is not null
        and public.has_client_permission(theirs.client_id, 'users.manage')
    );
$$;

-- ---------------------------------------------------------------------------
-- Integridad de alcance
-- ---------------------------------------------------------------------------

create or replace function public.touch_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
    if auth.uid() is not null and new.created_by is null then
      new.created_by := auth.uid();
    end if;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create or replace function public.touch_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.id := old.id;
    if not public.is_super_admin() and coalesce(auth.role(), '') = 'authenticated' then
      if new.status is distinct from old.status then
        raise exception 'Solo un super admin puede cambiar el estado global del usuario';
      end if;
      if new.email is distinct from old.email then
        raise exception 'No podés cambiar el email desde el panel';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_category_scope()
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
  return new;
end;
$$;

create or replace function public.enforce_knowledge_scope()
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

  if new.category_id is not null and not exists (
    select 1
    from public.categories c
    where c.id = new.category_id
      and c.project_id = new.project_id
  ) then
    raise exception 'La categoría no pertenece al proyecto';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_project_child_scope()
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
  return new;
end;
$$;

create or replace function public.enforce_embedding_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_project uuid;
begin
  select client_id, project_id into v_client, v_project
  from public.knowledge_items
  where id = new.knowledge_item_id;
  if v_client is null then
    raise exception 'Contenido inválido';
  end if;
  new.client_id := v_client;
  new.project_id := v_project;
  return new;
end;
$$;

create or replace function public.validate_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text;
  v_project_client uuid;
begin
  select scope into v_scope from public.roles where id = new.role_id;
  if v_scope is null then
    raise exception 'Rol inválido';
  end if;

  if v_scope = 'platform' then
    if new.client_id is not null or new.project_id is not null then
      raise exception 'Un rol de plataforma no se asigna a un cliente';
    end if;
  elsif v_scope = 'client' then
    if new.client_id is null or new.project_id is not null then
      raise exception 'Un rol de cliente cubre todos los proyectos de ese cliente';
    end if;
  else
    if new.client_id is null or new.project_id is null then
      raise exception 'Este rol se asigna a un proyecto';
    end if;
    select client_id into v_project_client from public.projects where id = new.project_id;
    if v_project_client is null or v_project_client <> new.client_id then
      raise exception 'El proyecto no pertenece al cliente';
    end if;
  end if;

  if coalesce(auth.role(), '') = 'authenticated' and not public.is_super_admin() then
    if v_scope = 'platform' then
      raise exception 'No podés asignar un rol de plataforma';
    end if;
    if new.client_id is null or not public.has_client_permission(new.client_id, 'users.manage') then
      raise exception 'No podés administrar usuarios de este cliente';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_permission_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text;
  v_allows boolean;
  v_client uuid;
begin
  if not exists (
    select 1
    from public.permission_override_allowlist a
    where a.permission_id = new.permission_id
  ) then
    raise exception 'Ese permiso no se puede ajustar por usuario';
  end if;

  select r.scope, r.allows_permission_overrides, m.client_id
    into v_scope, v_allows, v_client
  from public.memberships m
  join public.roles r on r.id = m.role_id
  where m.id = new.membership_id;

  if v_scope is distinct from 'project' or v_allows is distinct from true then
    raise exception 'Este rol no admite permisos adicionales';
  end if;

  if coalesce(auth.role(), '') = 'authenticated' and not public.is_super_admin() then
    if v_client is null or not public.has_client_permission(v_client, 'users.manage') then
      raise exception 'No podés modificar permisos de este usuario';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug !~ '^[a-z][a-z0-9_]{1,40}$' then
    raise exception 'El identificador del rol solo puede usar minúsculas y guion bajo';
  end if;
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    raise exception 'No se puede cambiar el identificador del rol';
  end if;
  if tg_op = 'UPDATE' and old.slug = 'super_admin' and coalesce(auth.role(), '') = 'authenticated' then
    if new.scope is distinct from old.scope or new.name is distinct from old.name then
      raise exception 'El rol super admin permanece fijo';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.protect_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role uuid;
  v_slug text;
begin
  v_role := coalesce(new.role_id, old.role_id);
  select slug into v_slug from public.roles where id = v_role;

  if coalesce(auth.role(), '') = 'authenticated'
     and not public.has_platform_permission('roles.manage') then
    raise exception 'No tenés permiso para administrar roles';
  end if;

  if v_slug = 'super_admin' and coalesce(auth.role(), '') = 'authenticated' then
    raise exception 'Los permisos del super admin quedan fijos para evitar un bloqueo';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.write_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_keys text[];
  v_action text;
  v_client uuid;
  v_project uuid;
  v_actor text;
  v_label text;
  v_role text;
begin
  v_row := to_jsonb(new);
  v_action := tg_table_name || case when tg_op = 'INSERT' then '.created' else '.updated' end;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    select coalesce(array_agg(n.key order by n.key), '{}'::text[])
      into v_keys
    from jsonb_each(v_row) n
    join jsonb_each(v_old) o on o.key = n.key
    where n.key not in ('updated_at', 'updated_by', 'created_at', 'created_by')
      and n.value is distinct from o.value;

    if v_keys is null or cardinality(v_keys) = 0 then
      return null;
    end if;

    if v_keys <@ array['active', 'status']::text[] then
      v_action := tg_table_name || '.status_changed';
    end if;
  end if;

  v_client := nullif(v_row->>'client_id', '')::uuid;
  v_project := nullif(v_row->>'project_id', '')::uuid;

  if tg_table_name = 'clients' then
    v_client := new.id;
  elsif tg_table_name = 'projects' then
    v_project := new.id;
  end if;

  select coalesce(nullif(full_name, ''), email, 'Usuario')
    into v_actor
  from public.profiles
  where id = auth.uid();

  v_label := coalesce(v_row->>'title', v_row->>'name', v_row->>'email', '');

  if tg_table_name = 'memberships' then
    select name into v_role from public.roles where id = new.role_id;
  end if;

  insert into public.activity_logs (
    client_id, project_id, user_id, action, entity_type, entity_id, metadata
  ) values (
    v_client,
    v_project,
    auth.uid(),
    v_action,
    tg_table_name,
    new.id,
    jsonb_strip_nulls(jsonb_build_object(
      'label', v_label,
      'actor_name', coalesce(v_actor, 'Sistema'),
      'role', v_role,
      'changed', case when tg_op = 'UPDATE' then to_jsonb(v_keys) else null end
    ))
  );

  return null;
end;
$$;

create trigger clients_touch before insert or update on public.clients
  for each row execute function public.touch_audit();
create trigger projects_touch before insert or update on public.projects
  for each row execute function public.touch_audit();
create trigger categories_touch before insert or update on public.categories
  for each row execute function public.touch_audit();
create trigger knowledge_touch before insert or update on public.knowledge_items
  for each row execute function public.touch_audit();
create trigger memberships_touch before insert or update on public.memberships
  for each row execute function public.touch_audit();
create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_profile();
create trigger roles_touch before insert or update on public.roles
  for each row execute function public.validate_role();

create trigger categories_scope before insert or update on public.categories
  for each row execute function public.enforce_category_scope();
create trigger knowledge_scope before insert or update on public.knowledge_items
  for each row execute function public.enforce_knowledge_scope();
create trigger memberships_validate before insert or update on public.memberships
  for each row execute function public.validate_membership();
create trigger overrides_validate before insert or update on public.membership_permission_overrides
  for each row execute function public.validate_permission_override();
create trigger role_permissions_protect before insert or update or delete on public.role_permissions
  for each row execute function public.protect_role_permissions();
create trigger whatsapp_scope before insert or update on public.project_whatsapp_settings
  for each row execute function public.enforce_project_child_scope();
create trigger reservations_scope before insert or update on public.project_reservation_settings
  for each row execute function public.enforce_project_child_scope();
create trigger embeddings_scope before insert or update on public.knowledge_item_embeddings
  for each row execute function public.enforce_embedding_scope();

create trigger clients_activity after insert or update on public.clients
  for each row execute function public.write_activity();
create trigger projects_activity after insert or update on public.projects
  for each row execute function public.write_activity();
create trigger categories_activity after insert or update on public.categories
  for each row execute function public.write_activity();
create trigger knowledge_activity after insert or update on public.knowledge_items
  for each row execute function public.write_activity();
create trigger memberships_activity after insert or update on public.memberships
  for each row execute function public.write_activity();
create trigger profiles_activity after insert or update on public.profiles
  for each row execute function public.write_activity();
create trigger roles_activity after insert or update on public.roles
  for each row execute function public.write_activity();

-- El alta de un usuario de Auth crea el perfil. No hay alta pública en el panel.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null then
    raise exception 'El usuario necesita un email';
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Consultas de la aplicación
-- ---------------------------------------------------------------------------

create or replace function public.my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  profile public.profiles%rowtype;
  is_super boolean;
  platform jsonb;
  clients_json jsonb;
  projects_json jsonb;
begin
  if uid is null then
    return jsonb_build_object('authenticated', false, 'active', false);
  end if;

  select * into profile from public.profiles where id = uid;
  if not found or profile.status <> 'active' then
    return jsonb_build_object(
      'authenticated', true,
      'active', false,
      'isSuperAdmin', false,
      'user', jsonb_build_object(
        'id', uid,
        'email', coalesce(profile.email, ''),
        'fullName', coalesce(profile.full_name, '')
      ),
      'platformPermissions', '[]'::jsonb,
      'clients', '[]'::jsonb,
      'projects', '[]'::jsonb
    );
  end if;

  is_super := public.is_super_admin();

  select coalesce(jsonb_agg(distinct ep.slug), '[]'::jsonb)
    into platform
  from public.memberships m
  join public.roles r on r.id = m.role_id
  cross join lateral public.effective_permissions(m.id) ep
  where m.user_id = uid
    and m.active
    and m.client_id is null
    and m.project_id is null
    and r.scope = 'platform';

  select coalesce(jsonb_agg(item order by item->>'clientName', item->>'name'), '[]'::jsonb)
    into projects_json
  from (
    select jsonb_build_object(
      'id', p.id,
      'clientId', p.client_id,
      'clientName', c.name,
      'name', p.name,
      'status', p.status,
      'permissions', coalesce((
        select jsonb_agg(distinct ep.slug)
        from public.memberships m
        cross join lateral public.effective_permissions(m.id) ep
        join public.roles r on r.id = m.role_id
        where m.user_id = uid
          and m.active
          and (
            (m.client_id is null and m.project_id is null and r.scope = 'platform' and is_super)
            or m.project_id = p.id
            or (m.project_id is null and m.client_id = p.client_id)
          )
      ), '[]'::jsonb)
    ) as item
    from public.projects p
    join public.clients c on c.id = p.client_id
    where public.has_project_access(p.id)
  ) rows;

  select coalesce(jsonb_agg(item order by item->>'name'), '[]'::jsonb)
    into clients_json
  from (
    select jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'status', c.status,
      'permissions', coalesce((
        select jsonb_agg(distinct ep.slug)
        from public.memberships m
        join public.roles r on r.id = m.role_id
        cross join lateral public.effective_permissions(m.id) ep
        where m.user_id = uid
          and m.active
          and (
            (m.client_id is null and m.project_id is null and r.scope = 'platform' and is_super)
            or m.client_id = c.id
          )
      ), '[]'::jsonb)
    ) as item
    from public.clients c
    where public.has_client_access(c.id)
  ) rows;

  return jsonb_build_object(
    'authenticated', true,
    'active', true,
    'isSuperAdmin', is_super,
    'user', jsonb_build_object(
      'id', profile.id,
      'email', profile.email,
      'fullName', profile.full_name
    ),
    'platformPermissions', coalesce(platform, '[]'::jsonb),
    'clients', clients_json,
    'projects', projects_json
  );
end;
$$;

create or replace function public.profile_id_for_invite(target_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if not public.is_super_admin() and not exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.active
      and m.client_id is not null
      and public.has_client_permission(m.client_id, 'users.manage')
  ) then
    raise exception 'No tenés permiso para invitar usuarios';
  end if;

  return (
    select id
    from public.profiles
    where lower(email) = lower(trim(target_email))
  );
end;
$$;

create or replace function public.project_user_count(p_project_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_project_access(p_project_id) then
    raise exception 'No tenés acceso a ese proyecto';
  end if;

  return (
    select count(distinct m.user_id)::integer
    from public.memberships m
    join public.projects pr on pr.id = p_project_id
    join public.profiles pf on pf.id = m.user_id
    where m.active
      and pf.status = 'active'
      and m.client_id = pr.client_id
      and (m.project_id is null or m.project_id = pr.id)
  );
end;
$$;

create or replace function public.set_role_permissions(p_role_id uuid, p_slugs text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  if coalesce(auth.role(), '') <> 'authenticated'
     or not public.has_platform_permission('roles.manage') then
    raise exception 'No tenés permiso para administrar roles';
  end if;

  select slug into v_slug from public.roles where id = p_role_id;
  if v_slug is null then
    raise exception 'Rol inexistente';
  end if;
  if v_slug = 'super_admin' then
    raise exception 'Los permisos del super admin quedan fijos para evitar un bloqueo';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_slugs, '{}'::text[])) as s(slug)
    where not exists (select 1 from public.permissions p where p.slug = s.slug)
  ) then
    raise exception 'Hay permisos desconocidos';
  end if;

  delete from public.role_permissions where role_id = p_role_id;

  insert into public.role_permissions (role_id, permission_id)
  select p_role_id, p.id
  from public.permissions p
  where p.slug = any (coalesce(p_slugs, '{}'::text[]));

  insert into public.activity_logs (
    client_id, project_id, user_id, action, entity_type, entity_id, metadata
  ) values (
    null,
    null,
    auth.uid(),
    'roles.permissions_updated',
    'roles',
    p_role_id,
    jsonb_build_object('slugs', coalesce(p_slugs, '{}'::text[]), 'label', v_slug)
  );
end;
$$;

-- Búsqueda léxica. La firma se mantiene cuando se reemplace por embeddings.
create or replace function public.search_knowledge(p_project_id uuid, p_query text)
returns table (
  id uuid,
  title text,
  question text,
  answer text,
  priority text,
  category_name text,
  score integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with norm as (
    select public.normalize_text(left(trim(coalesce(p_query, '')), 200)) as q
  ),
  tokens as (
    select distinct token
    from norm,
    lateral unnest(regexp_split_to_array(q, '[^a-z0-9]+')) as token
    where length(token) >= 2
      and token not in (
        'de','la','el','los','las','un','una','unos','unas','y','o','u','en','con','por','para',
        'que','es','del','al','como','puedo','puede','se','su','sus','mi','me','te','lo','le',
        'hay','son','esta','este','esto','esa','ese','a','the','and','or','donde','cuando'
      )
  ),
  base as (
    select
      k.id,
      k.title,
      k.question,
      k.answer,
      k.priority,
      c.name as category_name,
      public.normalize_text(k.title) as n_title,
      public.normalize_text(k.question) as n_question,
      public.normalize_text(k.answer) as n_answer,
      (
        select coalesce(array_agg(public.normalize_text(kw)), '{}'::text[])
        from unnest(k.keywords) as kw
      ) as n_keywords,
      n.q
    from public.knowledge_items k
    cross join norm n
    left join public.categories c on c.id = k.category_id
    where k.project_id = p_project_id
      and k.active = true
      and length(n.q) >= 2
  ),
  scored as (
    select
      b.id,
      b.title,
      b.question,
      b.answer,
      b.priority,
      b.category_name,
      (
        case
          when b.n_question = b.q then 100
          when b.q <> '' and b.n_question like '%' || b.q || '%' then 58
          else 0
        end
        + case
          when b.n_title = b.q then 84
          when b.q <> '' and b.n_title like '%' || b.q || '%' then 42
          else 0
        end
        + case when b.q <> '' and b.n_answer like '%' || b.q || '%' then 24 else 0 end
        + case
            when b.q = any (b.n_keywords) then 70
            when b.q <> '' and exists (
              select 1 from unnest(b.n_keywords) kw where kw like '%' || b.q || '%'
            ) then 36
            else 0
          end
        + coalesce((
            select sum(
              case
                when t.token = any (b.n_keywords) then 28
                when b.n_question like '%' || t.token || '%' then 16
                when b.n_title like '%' || t.token || '%' then 14
                when exists (
                  select 1 from unnest(b.n_keywords) kw where kw like '%' || t.token || '%'
                ) then 12
                when b.n_answer like '%' || t.token || '%' then 8
                else 0
              end
            )::integer
            from tokens t
          ), 0)
      )::integer as base_score
    from base b
  )
  select
    s.id,
    s.title,
    s.question,
    s.answer,
    s.priority,
    s.category_name,
    (
      s.base_score + case s.priority when 'critical' then 12 when 'high' then 6 else 0 end
    )::integer as score
  from scored s
  where s.base_score > 0
  order by score desc, s.title
  limit 15;
$$;

-- Primera puesta en marcha, antes de que exista un super admin.
-- Se ejecuta desde el SQL editor o con service role. Un usuario autenticado no puede llamarla.
create or replace function public.bootstrap_super_admin(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  rid uuid;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Esta función se ejecuta desde el SQL editor o con service role';
  end if;

  if exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where r.slug = 'super_admin'
  ) then
    raise exception 'Ya existe un super admin';
  end if;

  select id into uid from public.profiles where lower(email) = lower(trim(target_email));
  if uid is null then
    raise exception 'No hay un usuario con ese email. Crealo primero en Authentication.';
  end if;

  select id into rid from public.roles where slug = 'super_admin';

  insert into public.memberships (user_id, client_id, project_id, role_id)
  values (uid, null, null, rid);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.permission_override_allowlist enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_permission_overrides enable row level security;
alter table public.categories enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.activity_logs enable row level security;
alter table public.knowledge_item_embeddings enable row level security;
alter table public.project_whatsapp_settings enable row level security;
alter table public.project_reservation_settings enable row level security;

create policy permissions_select on public.permissions
  for select to authenticated using (true);

create policy allowlist_select on public.permission_override_allowlist
  for select to authenticated using (true);

create policy roles_select on public.roles
  for select to authenticated using (true);
create policy roles_insert on public.roles
  for insert to authenticated
  with check (public.has_platform_permission('roles.manage'));
create policy roles_update on public.roles
  for update to authenticated
  using (public.has_platform_permission('roles.manage'))
  with check (public.has_platform_permission('roles.manage'));

create policy role_permissions_select on public.role_permissions
  for select to authenticated using (true);
create policy role_permissions_insert on public.role_permissions
  for insert to authenticated
  with check (public.has_platform_permission('roles.manage'));
create policy role_permissions_delete on public.role_permissions
  for delete to authenticated
  using (public.has_platform_permission('roles.manage'));

create policy clients_select on public.clients
  for select to authenticated
  using (public.has_client_access(id));
create policy clients_insert on public.clients
  for insert to authenticated
  with check (public.has_platform_permission('clients.write'));
create policy clients_update on public.clients
  for update to authenticated
  using (public.has_platform_permission('clients.write'))
  with check (public.has_platform_permission('clients.write'));

create policy projects_select on public.projects
  for select to authenticated
  using (public.has_project_access(id));
create policy projects_insert on public.projects
  for insert to authenticated
  with check (
    public.has_platform_permission('projects.write')
    and public.has_client_access(client_id)
  );
create policy projects_update on public.projects
  for update to authenticated
  using (public.has_platform_permission('projects.write') and public.has_project_access(id))
  with check (public.has_platform_permission('projects.write') and public.has_client_access(client_id));

create policy profiles_select on public.profiles
  for select to authenticated
  using (public.can_read_profile(id));
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.can_update_profile(id))
  with check (public.can_update_profile(id));

create policy memberships_select on public.memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin()
    or (client_id is not null and public.has_client_permission(client_id, 'users.read'))
  );
create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (public.can_write_membership(client_id, role_id));
create policy memberships_update on public.memberships
  for update to authenticated
  using (public.can_write_membership(client_id, role_id))
  with check (public.can_write_membership(client_id, role_id));

create policy overrides_select on public.membership_permission_overrides
  for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.id = membership_id
        and (
          m.user_id = auth.uid()
          or public.is_super_admin()
          or (m.client_id is not null and public.has_client_permission(m.client_id, 'users.read'))
        )
    )
  );
create policy overrides_insert on public.membership_permission_overrides
  for insert to authenticated
  with check (
    exists (
      select 1 from public.memberships m
      where m.id = membership_id
        and public.can_write_membership(m.client_id, m.role_id)
    )
  );
create policy overrides_delete on public.membership_permission_overrides
  for delete to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.id = membership_id
        and public.can_write_membership(m.client_id, m.role_id)
    )
  );

create policy categories_select on public.categories
  for select to authenticated
  using (public.has_permission(project_id, 'categories.read'));
create policy categories_insert on public.categories
  for insert to authenticated
  with check (public.has_permission(project_id, 'categories.write'));
create policy categories_update on public.categories
  for update to authenticated
  using (public.has_permission(project_id, 'categories.write'))
  with check (public.has_permission(project_id, 'categories.write'));

create policy knowledge_select on public.knowledge_items
  for select to authenticated
  using (public.has_permission(project_id, 'knowledge.read'));
create policy knowledge_insert on public.knowledge_items
  for insert to authenticated
  with check (public.has_permission(project_id, 'knowledge.write'));
create policy knowledge_update on public.knowledge_items
  for update to authenticated
  using (public.has_permission(project_id, 'knowledge.write'))
  with check (public.has_permission(project_id, 'knowledge.write'));

create policy activity_select on public.activity_logs
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      client_id is not null
      and public.has_client_permission(client_id, 'activity.read')
      and (project_id is null or public.has_project_access(project_id))
    )
  );

create policy embeddings_select on public.knowledge_item_embeddings
  for select to authenticated
  using (public.has_permission(project_id, 'knowledge.read'));
create policy embeddings_insert on public.knowledge_item_embeddings
  for insert to authenticated
  with check (public.has_permission(project_id, 'knowledge.write'));
create policy embeddings_update on public.knowledge_item_embeddings
  for update to authenticated
  using (public.has_permission(project_id, 'knowledge.write'))
  with check (public.has_permission(project_id, 'knowledge.write'));

-- Hasta que existan los módulos, solo un super admin llega a estas tablas.
create policy whatsapp_all on public.project_whatsapp_settings
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy reservations_all on public.project_reservation_settings
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Permisos de ejecución. anon no tiene acceso a las tablas.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
grant select on public.permissions, public.permission_override_allowlist to authenticated;
grant select, insert, update on public.roles to authenticated;
grant select, insert, delete on public.role_permissions to authenticated;
grant select, insert, update on public.clients, public.projects, public.profiles to authenticated;
grant select, insert, update on public.memberships to authenticated;
grant select, insert, delete on public.membership_permission_overrides to authenticated;
grant select, insert, update on public.categories, public.knowledge_items to authenticated;
grant select on public.activity_logs to authenticated;
grant select, insert, update on public.knowledge_item_embeddings to authenticated;
grant select, insert, update on public.project_whatsapp_settings to authenticated;
grant select, insert, update on public.project_reservation_settings to authenticated;

revoke all on function public.my_access() from public, anon;
revoke all on function public.profile_id_for_invite(text) from public, anon;
revoke all on function public.project_user_count(uuid) from public, anon;
revoke all on function public.set_role_permissions(uuid, text[]) from public, anon;
revoke all on function public.search_knowledge(uuid, text) from public, anon;
revoke all on function public.bootstrap_super_admin(text) from public, anon, authenticated;
revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.has_platform_permission(text) from public, anon;
revoke all on function public.has_client_permission(uuid, text) from public, anon;
revoke all on function public.has_project_access(uuid) from public, anon;
revoke all on function public.has_permission(uuid, text) from public, anon;
revoke all on function public.has_client_access(uuid) from public, anon;
revoke all on function public.effective_permissions(uuid) from public, anon;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.has_platform_permission(text) to authenticated;
grant execute on function public.has_client_permission(uuid, text) to authenticated;
grant execute on function public.has_project_access(uuid) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.has_client_access(uuid) to authenticated;
grant execute on function public.can_write_membership(uuid, uuid) to authenticated;
grant execute on function public.can_read_profile(uuid) to authenticated;
grant execute on function public.can_update_profile(uuid) to authenticated;
grant execute on function public.effective_permissions(uuid) to authenticated;
grant execute on function public.my_access() to authenticated;
grant execute on function public.profile_id_for_invite(text) to authenticated;
grant execute on function public.project_user_count(uuid) to authenticated;
grant execute on function public.set_role_permissions(uuid, text[]) to authenticated;
grant execute on function public.search_knowledge(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.bootstrap_super_admin(text) to service_role;
  end if;
end $$;
