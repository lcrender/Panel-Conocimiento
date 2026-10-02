-- Pruebas del playground. No guarda conocimiento de otros proyectos:
-- el trigger copia client_id y fuerza user_id = auth.uid().

create table public.knowledge_tests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  query text not null,
  answer text not null,
  status text not null check (status in ('answered', 'no_answer', 'clarification_needed', 'conflicting_information')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  used_knowledge_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index knowledge_tests_project_created_idx
  on public.knowledge_tests (project_id, created_at desc);

alter table public.knowledge_tests enable row level security;

create or replace function public.enforce_knowledge_test_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  select client_id into v_client from public.projects where id = new.project_id;
  if v_client is null then
    raise exception 'Proyecto inválido';
  end if;

  new.client_id := v_client;
  new.user_id := auth.uid();
  return new;
end;
$$;

create trigger knowledge_tests_scope
  before insert on public.knowledge_tests
  for each row execute function public.enforce_knowledge_test_scope();

create policy knowledge_tests_select on public.knowledge_tests
  for select to authenticated
  using (public.has_permission(project_id, 'knowledge.read'));

create policy knowledge_tests_insert on public.knowledge_tests
  for insert to authenticated
  with check (public.has_permission(project_id, 'knowledge.read'));

revoke all on public.knowledge_tests from public, anon, authenticated;
grant select, insert on public.knowledge_tests to authenticated;
