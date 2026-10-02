-- Umbral de similitud por proyecto. Null usa el valor general (0,35 salvo que el entorno indique otro).

alter table public.project_ai_settings
  add column if not exists similarity_threshold numeric(3,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_ai_similarity_range'
  ) then
    alter table public.project_ai_settings
      add constraint project_ai_similarity_range
      check (
        similarity_threshold is null
        or (similarity_threshold >= 0 and similarity_threshold <= 1)
      );
  end if;
end $$;
