-- Edição em massa de campos simples e etiquetas.
--
-- Funções em vez de PATCH via PostgREST: com até 500 ids, um filtro
-- id=in.(...) na URL passa de 18 KB e pode ser recusado pelo gateway; no RPC os
-- ids vão no corpo. Cada função roda numa transação só: se algum id não
-- existir, nada é alterado (SQLSTATE P0002).

-- Altera um campo simples: local_id, pessoa_id, frequencia_uso, estado ou
-- situacao. p_valor null limpa o campo (situacao não aceita null). Em situacao,
-- emprestado_para recebe p_emprestado_para quando 'emprestado' e null nos
-- demais casos (como no formulário). Os CHECKs e FKs da tabela validam os valores.
create or replace function itens_alterar_campo(
  p_ids uuid[],
  p_campo text,
  p_valor text,
  p_emprestado_para text default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total integer;
begin
  case p_campo
    when 'local_id' then
      update itens set local_id = p_valor::uuid where id = any(p_ids);
    when 'pessoa_id' then
      update itens set pessoa_id = p_valor::uuid where id = any(p_ids);
    when 'frequencia_uso' then
      update itens set frequencia_uso = p_valor where id = any(p_ids);
    when 'estado' then
      update itens set estado = p_valor where id = any(p_ids);
    when 'situacao' then
      update itens
         set situacao = p_valor,
             emprestado_para = case
               when p_valor = 'emprestado' then nullif(btrim(p_emprestado_para), '')
             end
       where id = any(p_ids);
    else
      raise exception 'campo inválido: %', p_campo using errcode = '22023';
  end case;

  get diagnostics v_total = row_count;

  if v_total <> (select count(distinct x) from unnest(p_ids) as x) then
    raise exception 'algum item não existe' using errcode = 'P0002';
  end if;

  return v_total;
end;
$$;

-- Trava os itens e confere que todos existem; devolve quantos são.
create or replace function itens_travar(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total integer;
begin
  select count(*) into v_total
  from (select id from itens where id = any(p_ids) for update) t;

  if v_total <> (select count(distinct x) from unnest(p_ids) as x) then
    raise exception 'algum item não existe' using errcode = 'P0002';
  end if;

  return v_total;
end;
$$;

-- Adiciona a etiqueta aos itens que ainda não a têm (comparação sem distinção
-- de maiúsculas, como no formulário). Devolve o total de itens selecionados.
create or replace function itens_adicionar_etiqueta(p_ids uuid[], p_etiqueta text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_etiqueta text := btrim(p_etiqueta);
  v_total    integer;
begin
  if v_etiqueta is null or v_etiqueta = '' then
    raise exception 'etiqueta vazia' using errcode = '22023';
  end if;

  v_total := itens_travar(p_ids);

  update itens
     set etiquetas = array_append(etiquetas, v_etiqueta)
   where id = any(p_ids)
     and not exists (
       select 1 from unnest(etiquetas) as e where lower(e) = lower(v_etiqueta)
     );

  return v_total;
end;
$$;

-- Remove a etiqueta (valor exato) dos itens que a têm. Devolve o total de
-- itens selecionados.
create or replace function itens_remover_etiqueta(p_ids uuid[], p_etiqueta text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total integer;
begin
  v_total := itens_travar(p_ids);

  update itens
     set etiquetas = array_remove(etiquetas, p_etiqueta)
   where id = any(p_ids)
     and p_etiqueta = any(etiquetas);

  return v_total;
end;
$$;

revoke execute on function itens_alterar_campo(uuid[], text, text, text) from public, anon;
revoke execute on function itens_travar(uuid[]) from public, anon;
revoke execute on function itens_adicionar_etiqueta(uuid[], text) from public, anon;
revoke execute on function itens_remover_etiqueta(uuid[], text) from public, anon;

grant execute on function itens_alterar_campo(uuid[], text, text, text) to authenticated;
grant execute on function itens_travar(uuid[]) to authenticated;
grant execute on function itens_adicionar_etiqueta(uuid[], text) to authenticated;
grant execute on function itens_remover_etiqueta(uuid[], text) to authenticated;
