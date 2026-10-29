-- 0001_schema.sql
-- Inventário doméstico (single-tenant). Requer PostgreSQL 15+ (NULLS NOT DISTINCT, security_invoker).

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- tipos_local
-- ---------------------------------------------------------------------------
create table tipos_local (
  sigla      text primary key check (sigla ~ '^[A-Z]{2,4}$'),
  nome       text not null,
  eh_comodo  boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- locais
-- ---------------------------------------------------------------------------
create table locais (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid null references locais (id) on delete restrict,
  tipo_sigla text not null references tipos_local (sigla) on update cascade on delete restrict,
  numero     int null check (numero between 1 and 99),
  codigo     text generated always as (
               tipo_sigla || case when numero is null then '' else '-' || lpad(numero::text, 2, '0') end
             ) stored,
  descricao  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locais_codigo_unico_no_pai unique nulls not distinct (parent_id, codigo),
  constraint locais_parent_nao_eh_self check (parent_id is distinct from id)
);

create trigger locais_set_updated_at
  before update on locais
  for each row execute function set_updated_at();

create or replace function locais_validar_hierarquia()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_eh_comodo boolean;
begin
  select eh_comodo into v_eh_comodo
  from tipos_local
  where sigla = new.tipo_sigla;

  if v_eh_comodo and new.parent_id is not null then
    raise exception 'Local do tipo % é um cômodo e não pode ter parent_id; cômodos ficam na raiz.',
      new.tipo_sigla;
  end if;

  if v_eh_comodo is false and new.parent_id is null then
    raise exception 'Local do tipo % não é um cômodo e precisa de parent_id.',
      new.tipo_sigla;
  end if;

  -- Ciclo: o novo pai não pode ser o próprio local nem um de seus descendentes.
  if tg_op = 'UPDATE' and new.parent_id is not null and new.parent_id is distinct from old.parent_id then
    if exists (
      with recursive ancestrais as (
        select l.id, l.parent_id
        from locais l
        where l.id = new.parent_id
        union
        select l.id, l.parent_id
        from locais l
        join ancestrais a on l.id = a.parent_id
      )
      select 1 from ancestrais where id = new.id
    ) then
      raise exception 'Operação criaria um ciclo na hierarquia de locais (local %).', new.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger locais_validar_hierarquia
  before insert or update on locais
  for each row execute function locais_validar_hierarquia();

-- ---------------------------------------------------------------------------
-- locais_enderecos
--   endereco: cômodo -> "QRT-01"; demais -> "QRT-01 ARM-MOD-01-GAV-01"
--   caminho_nomes: "Quarto 01 > Armário > Módulo 01 > Gaveta 01"
-- ---------------------------------------------------------------------------
create view locais_enderecos
with (security_invoker = true) as
with recursive cadeia as (
  select
    l.id,
    l.codigo,
    l.id as comodo_id,
    l.codigo as comodo_codigo,
    null::text as abaixo_do_comodo,
    t.nome || case when l.numero is null then '' else ' ' || lpad(l.numero::text, 2, '0') end as caminho_nomes
  from locais l
  join tipos_local t on t.sigla = l.tipo_sigla
  where l.parent_id is null

  union all

  select
    c.id,
    c.codigo,
    p.comodo_id,
    p.comodo_codigo,
    case when p.abaixo_do_comodo is null then c.codigo else p.abaixo_do_comodo || '-' || c.codigo end,
    p.caminho_nomes || ' > ' || t.nome || case when c.numero is null then '' else ' ' || lpad(c.numero::text, 2, '0') end
  from locais c
  join cadeia p on c.parent_id = p.id
  join tipos_local t on t.sigla = c.tipo_sigla
)
select
  id,
  codigo,
  comodo_id,
  case
    when abaixo_do_comodo is null then comodo_codigo
    else comodo_codigo || ' ' || abaixo_do_comodo
  end as endereco,
  caminho_nomes
from cadeia;

-- ---------------------------------------------------------------------------
-- pessoas
-- ---------------------------------------------------------------------------
create table pessoas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categorias
--   atributos_schema: array de { chave, rotulo, tipo, opcoes? }
--   tipo in ('texto','numero','lista','multilista','booleano'); opcoes: string[]
--   Subcategorias herdam o schema do pai (resolvido na aplicação).
-- ---------------------------------------------------------------------------
create table categorias (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  parent_id        uuid null references categorias (id) on delete restrict,
  natureza_padrao  text not null default 'duravel' check (natureza_padrao in ('duravel', 'consumivel')),
  atributos_schema jsonb not null default '[]',
  ordem            int not null default 0,
  created_at       timestamptz not null default now(),
  constraint categorias_nome_unico_no_pai unique nulls not distinct (parent_id, nome)
);

-- ---------------------------------------------------------------------------
-- itens
-- ---------------------------------------------------------------------------
create table itens (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  categoria_id     uuid not null references categorias (id) on delete restrict,
  local_id         uuid not null references locais (id) on delete restrict,
  pessoa_id        uuid null references pessoas (id) on delete set null,
  natureza         text not null default 'duravel' check (natureza in ('duravel', 'consumivel')),
  quantidade       numeric(12, 3) not null default 1 check (quantidade >= 0),
  unidade          text not null default 'un',
  marca            text,
  modelo           text,
  frequencia_uso   text null check (frequencia_uso in ('diario', 'semanal', 'mensal', 'raro', 'sazonal')),
  estado           text null check (estado in ('novo', 'bom', 'desgastado', 'com_defeito')),
  situacao         text not null default 'guardado'
                     check (situacao in ('em_uso', 'guardado', 'emprestado', 'para_doar', 'para_descartar')),
  emprestado_para  text,
  data_aquisicao   date,
  garantia_ate     date,
  valor_pago       numeric(12, 2) check (valor_pago >= 0),
  atributos        jsonb not null default '{}',
  etiquetas        text[] not null default '{}',
  observacoes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint itens_emprestado_requer_destino
    check (situacao <> 'emprestado' or nullif(trim(emprestado_para), '') is not null)
);

create trigger itens_set_updated_at
  before update on itens
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- item_fotos
-- ---------------------------------------------------------------------------
create table item_fotos (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references itens (id) on delete cascade,
  storage_path text not null,
  ordem        int not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index itens_nome_trgm_idx      on itens using gin (nome extensions.gin_trgm_ops);
create index itens_atributos_gin_idx  on itens using gin (atributos);
create index itens_etiquetas_gin_idx  on itens using gin (etiquetas);
create index itens_categoria_id_idx   on itens (categoria_id);
create index itens_local_id_idx       on itens (local_id);
create index itens_pessoa_id_idx      on itens (pessoa_id);
create index item_fotos_item_id_idx   on item_fotos (item_id);
create index locais_parent_id_idx     on locais (parent_id);
create index categorias_parent_id_idx on categorias (parent_id);

-- ---------------------------------------------------------------------------
-- RLS: só o papel authenticated; anon não tem policy (sem acesso).
-- ---------------------------------------------------------------------------
alter table tipos_local enable row level security;
alter table locais      enable row level security;
alter table pessoas     enable row level security;
alter table categorias  enable row level security;
alter table itens       enable row level security;
alter table item_fotos  enable row level security;

create policy tipos_local_authenticated_all on tipos_local
  for all to authenticated using (true) with check (true);

create policy locais_authenticated_all on locais
  for all to authenticated using (true) with check (true);

create policy pessoas_authenticated_all on pessoas
  for all to authenticated using (true) with check (true);

create policy categorias_authenticated_all on categorias
  for all to authenticated using (true) with check (true);

create policy itens_authenticated_all on itens
  for all to authenticated using (true) with check (true);

create policy item_fotos_authenticated_all on item_fotos
  for all to authenticated using (true) with check (true);
