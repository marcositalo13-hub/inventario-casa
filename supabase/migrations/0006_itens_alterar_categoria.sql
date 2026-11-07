-- Troca de categoria em massa, calculada no banco.
--
-- Schema efetivo de uma categoria = atributos_schema do pai + o próprio; em
-- chave repetida vale a definição da própria categoria (mesma regra de
-- schemaEfetivo em src/lib/itens.ts).
--
-- Regras de limpeza dos atributos de cada item, contra o schema efetivo:
--   - chave fora do schema: removida;
--   - texto / numero / booleano: mantida só se o tipo JSON bate
--     (string / number / boolean);
--   - lista: mantida só se o valor é uma das opcoes;
--   - multilista: mantém só os valores que estão nas opcoes; sem nenhum, a
--     chave sai.

-- Schema efetivo como objeto { chave: definição }.
create or replace function categoria_schema_efetivo(p_categoria_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_object_agg(t.chave, t.def), '{}'::jsonb)
  from (
    select distinct on (d.def ->> 'chave')
      d.def ->> 'chave' as chave,
      d.def
    from (
      -- prioridade 0 = a própria categoria, 1 = o pai
      select c.atributos_schema as s, 0 as prioridade
      from categorias c
      where c.id = p_categoria_id
      union all
      select p.atributos_schema, 1
      from categorias c
      join categorias p on p.id = c.parent_id
      where c.id = p_categoria_id
    ) x
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(x.s) = 'array' then x.s else '[]'::jsonb end
    ) as d(def)
    where d.def ->> 'chave' is not null
    order by d.def ->> 'chave', x.prioridade
  ) t;
$$;

-- Atributos de um item filtrados pelo schema efetivo (objeto da função acima).
create or replace function itens_atributos_filtrados(p_atributos jsonb, p_schema jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_object_agg(a.chave, a.valor), '{}'::jsonb)
  from (
    select
      e.key as chave,
      case s.def ->> 'tipo'
        when 'texto' then
          case when jsonb_typeof(e.value) = 'string' then e.value end
        when 'numero' then
          case when jsonb_typeof(e.value) = 'number' then e.value end
        when 'booleano' then
          case when jsonb_typeof(e.value) = 'boolean' then e.value end
        when 'lista' then
          case
            when jsonb_typeof(e.value) = 'string'
              and coalesce(s.def -> 'opcoes', '[]'::jsonb) ? (e.value #>> '{}')
            then e.value
          end
        when 'multilista' then
          case when jsonb_typeof(e.value) = 'array' then (
            -- jsonb_agg de zero linhas é null: a chave sai.
            select jsonb_agg(m.v order by m.ord)
            from jsonb_array_elements(e.value) with ordinality as m(v, ord)
            where jsonb_typeof(m.v) = 'string'
              and coalesce(s.def -> 'opcoes', '[]'::jsonb) ? (m.v #>> '{}')
          ) end
      end as valor
    from jsonb_each(
      case when jsonb_typeof(p_atributos) = 'object' then p_atributos else '{}'::jsonb end
    ) as e
    cross join lateral (select p_schema -> e.key as def) s
    where s.def is not null
  ) a
  where a.valor is not null;
$$;

-- Move os itens para a categoria, limpando atributos e ajustando a natureza.
-- Um único UPDATE; se algum id não existir, nada é alterado.
create or replace function itens_alterar_categoria(p_ids uuid[], p_categoria_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_natureza text;
  v_schema   jsonb;
  v_total    integer;
begin
  select coalesce(c.natureza_padrao, p.natureza_padrao, 'duravel')
    into v_natureza
  from categorias c
  left join categorias p on p.id = c.parent_id
  where c.id = p_categoria_id;

  if not found then
    raise exception 'categoria % não encontrada', p_categoria_id using errcode = 'P0002';
  end if;

  v_schema := categoria_schema_efetivo(p_categoria_id);

  update itens
     set categoria_id = p_categoria_id,
         natureza     = v_natureza,
         atributos    = itens_atributos_filtrados(atributos, v_schema)
   where id = any(p_ids);

  get diagnostics v_total = row_count;

  if v_total <> (select count(distinct x) from unnest(p_ids) as x) then
    raise exception 'algum item não existe' using errcode = 'P0002';
  end if;

  return v_total;
end;
$$;

-- Prévia, só leitura: chaves de atributo que seriam removidas e em quantos itens.
create or replace function itens_preview_alterar_categoria(p_ids uuid[], p_categoria_id uuid)
returns table (chave text, itens_afetados int)
language sql
stable
security invoker
set search_path = public
as $$
  with s as (select categoria_schema_efetivo(p_categoria_id) as schema),
  f as (
    select i.atributos, itens_atributos_filtrados(i.atributos, s.schema) as filtrados
    from itens i, s
    where i.id = any(p_ids)
      and jsonb_typeof(i.atributos) = 'object'
  )
  select e.key as chave, count(*)::int as itens_afetados
  from f
  cross join lateral jsonb_object_keys(f.atributos) as e(key)
  where not (f.filtrados ? e.key)
  group by e.key
  order by e.key;
$$;

-- Só usuários autenticados (o Supabase concede execute a anon por padrão).
revoke execute on function categoria_schema_efetivo(uuid) from public, anon;
revoke execute on function itens_atributos_filtrados(jsonb, jsonb) from public, anon;
revoke execute on function itens_alterar_categoria(uuid[], uuid) from public, anon;
revoke execute on function itens_preview_alterar_categoria(uuid[], uuid) from public, anon;

grant execute on function categoria_schema_efetivo(uuid) to authenticated;
grant execute on function itens_atributos_filtrados(jsonb, jsonb) to authenticated;
grant execute on function itens_alterar_categoria(uuid[], uuid) to authenticated;
grant execute on function itens_preview_alterar_categoria(uuid[], uuid) to authenticated;
