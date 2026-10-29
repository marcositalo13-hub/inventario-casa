-- 0002_seed_tipos_local.sql (idempotente)

insert into tipos_local (sigla, nome, eh_comodo) values
  -- Cômodos
  ('QRT', 'Quarto',           true),
  ('SAL', 'Sala',             true),
  ('COZ', 'Cozinha',          true),
  ('BAN', 'Banheiro',         true),
  ('ASV', 'Área de serviço',  true),
  ('GAR', 'Garagem',          true),
  ('ESC', 'Escritório',       true),
  ('EXT', 'Área externa',     true),
  -- Locais internos
  ('ARM', 'Armário',          false),
  ('MOD', 'Módulo',           false),
  ('GAV', 'Gaveta',           false),
  ('PRT', 'Prateleira',       false),
  ('NCH', 'Nicho',            false),
  ('CMD', 'Cômoda',           false),
  ('EST', 'Estante',          false),
  ('RCK', 'Rack',             false),
  ('CX',  'Caixa',            false),
  ('MAL', 'Mala',             false),
  ('ORG', 'Organizador',      false)
on conflict do nothing;
