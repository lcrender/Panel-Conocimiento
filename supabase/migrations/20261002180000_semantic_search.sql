-- Búsqueda semántica sobre knowledge_item_embeddings.
-- Esa tabla ya tiene vector(1536), índice HNSW y RLS por proyecto.
-- text-embedding-3-small usa 1536 dimensiones.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;

drop function if exists public.search_knowledge(uuid, text);

create or replace function public.search_knowledge(p_project_id uuid, p_query text)
returns table (
  id uuid,
  title text,
  question text,
  answer text,
  priority text,
  category_name text,
  score integer,
  allow_ai_rewrite boolean
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
      k.allow_ai_rewrite,
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
      b.allow_ai_rewrite,
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
    )::integer as score,
    s.allow_ai_rewrite
  from scored s
  where s.base_score > 0
  order by score desc, s.title
  limit 15;
$$;

create or replace function public.search_knowledge_semantic(
  p_project_id uuid,
  p_client_id uuid,
  p_embedding extensions.vector(1536),
  p_match_count integer default 5
)
returns table (
  id uuid,
  title text,
  question text,
  answer text,
  priority text,
  category_name text,
  allow_ai_rewrite boolean,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    k.id,
    k.title,
    k.question,
    k.answer,
    k.priority,
    c.name as category_name,
    k.allow_ai_rewrite,
    (1 - (e.embedding operator(extensions.<=>) p_embedding))::double precision as similarity
  from public.knowledge_item_embeddings e
  join public.knowledge_items k on k.id = e.knowledge_item_id
  left join public.categories c on c.id = k.category_id
  where e.project_id = p_project_id
    and e.client_id = p_client_id
    and k.project_id = p_project_id
    and k.client_id = p_client_id
    and k.active = true
    and e.model = 'text-embedding-3-small'
    and e.embedding is not null
  order by e.embedding operator(extensions.<=>) p_embedding
  limit least(greatest(coalesce(p_match_count, 5), 1), 5);
$$;

revoke all on function public.search_knowledge(uuid, text) from public, anon;
revoke all on function public.search_knowledge_semantic(uuid, uuid, extensions.vector(1536), integer) from public, anon;
grant execute on function public.search_knowledge(uuid, text) to authenticated;
grant execute on function public.search_knowledge_semantic(uuid, uuid, extensions.vector(1536), integer) to authenticated;
