-- 0003_seed_categorias.sql (idempotente: on conflict do nothing)
-- Categorias de topo (ordem = ordem listada) e, em seguida, subcategorias por busca do pai pelo nome.

insert into categorias (nome, natureza_padrao, ordem, atributos_schema) values
  ('Vestuário', 'duravel', 1, '[
    {"chave":"tamanho","rotulo":"Tamanho","tipo":"texto"},
    {"chave":"cor","rotulo":"Cor","tipo":"texto"},
    {"chave":"tecido","rotulo":"Tecido","tipo":"texto"},
    {"chave":"camada","rotulo":"Camada","tipo":"lista","opcoes":["base","intermediaria","externa"]},
    {"chave":"clima","rotulo":"Clima","tipo":"multilista","opcoes":["frio","ameno","calor"]},
    {"chave":"formalidade","rotulo":"Formalidade","tipo":"lista","opcoes":["casual","esporte","trabalho","social"]}
  ]'::jsonb),
  ('Calçados', 'duravel', 2, '[
    {"chave":"tamanho","rotulo":"Tamanho","tipo":"numero"},
    {"chave":"cor","rotulo":"Cor","tipo":"texto"},
    {"chave":"material","rotulo":"Material","tipo":"texto"},
    {"chave":"formalidade","rotulo":"Formalidade","tipo":"lista","opcoes":["casual","esporte","trabalho","social"]},
    {"chave":"impermeavel","rotulo":"Impermeável","tipo":"booleano"}
  ]'::jsonb),
  ('Acessórios pessoais', 'duravel', 3, '[
    {"chave":"cor","rotulo":"Cor","tipo":"texto"},
    {"chave":"material","rotulo":"Material","tipo":"texto"}
  ]'::jsonb),
  ('Ferramentas', 'duravel', 4, '[
    {"chave":"acionamento","rotulo":"Acionamento","tipo":"lista","opcoes":["manual","eletrica_fio","bateria"]},
    {"chave":"voltagem","rotulo":"Voltagem","tipo":"lista","opcoes":["110V","220V","bivolt","bateria"]},
    {"chave":"potencia_w","rotulo":"Potência (W)","tipo":"numero"},
    {"chave":"especificacao","rotulo":"Especificação","tipo":"texto"}
  ]'::jsonb),
  ('Ferragens e fixação', 'consumivel', 5, '[
    {"chave":"dimensao","rotulo":"Dimensão","tipo":"texto"},
    {"chave":"material","rotulo":"Material","tipo":"texto"},
    {"chave":"aplicacao","rotulo":"Aplicação","tipo":"multilista","opcoes":["alvenaria","madeira","drywall","metal","azulejo"]}
  ]'::jsonb),
  ('Eletrônicos', 'duravel', 6, '[
    {"chave":"voltagem","rotulo":"Voltagem","tipo":"lista","opcoes":["110V","220V","bivolt","bateria","usb"]},
    {"chave":"conectores","rotulo":"Conectores","tipo":"texto"},
    {"chave":"capacidade","rotulo":"Capacidade","tipo":"texto"},
    {"chave":"numero_serie","rotulo":"Número de série","tipo":"texto"}
  ]'::jsonb),
  ('Cabos, carregadores e adaptadores', 'duravel', 7, '[
    {"chave":"conector_a","rotulo":"Conector A","tipo":"texto"},
    {"chave":"conector_b","rotulo":"Conector B","tipo":"texto"},
    {"chave":"comprimento_m","rotulo":"Comprimento (m)","tipo":"numero"},
    {"chave":"padrao","rotulo":"Padrão","tipo":"texto"},
    {"chave":"potencia_w","rotulo":"Potência (W)","tipo":"numero"}
  ]'::jsonb),
  ('Eletrodomésticos', 'duravel', 8, '[
    {"chave":"voltagem","rotulo":"Voltagem","tipo":"lista","opcoes":["110V","220V","bivolt"]},
    {"chave":"potencia_w","rotulo":"Potência (W)","tipo":"numero"},
    {"chave":"numero_serie","rotulo":"Número de série","tipo":"texto"}
  ]'::jsonb),
  ('Cozinha e utensílios', 'duravel', 9, '[
    {"chave":"material","rotulo":"Material","tipo":"texto"}
  ]'::jsonb),
  ('Cama, mesa e banho', 'duravel', 10, '[
    {"chave":"tamanho","rotulo":"Tamanho","tipo":"texto"},
    {"chave":"cor","rotulo":"Cor","tipo":"texto"},
    {"chave":"material","rotulo":"Material","tipo":"texto"}
  ]'::jsonb),
  ('Móveis e decoração', 'duravel', 11, '[
    {"chave":"dimensoes","rotulo":"Dimensões","tipo":"texto"},
    {"chave":"material","rotulo":"Material","tipo":"texto"}
  ]'::jsonb),
  ('Livros e mídia', 'duravel', 12, '[
    {"chave":"autor","rotulo":"Autor","tipo":"texto"},
    {"chave":"idioma","rotulo":"Idioma","tipo":"texto"},
    {"chave":"leitura","rotulo":"Leitura","tipo":"lista","opcoes":["nao_lido","lendo","lido"]},
    {"chave":"nota_pessoal","rotulo":"Nota pessoal","tipo":"numero"}
  ]'::jsonb),
  ('Esporte e lazer', 'duravel', 13, '[]'::jsonb),
  ('Infantil', 'duravel', 14, '[]'::jsonb),
  ('Automotivo', 'duravel', 15, '[
    {"chave":"veiculo","rotulo":"Veículo","tipo":"texto"},
    {"chave":"especificacao","rotulo":"Especificação","tipo":"texto"}
  ]'::jsonb),
  ('Jardim e área externa', 'duravel', 16, '[]'::jsonb),
  ('Outros', 'duravel', 17, '[]'::jsonb)
on conflict do nothing;

-- Subcategorias: cada bloco busca o pai (topo) pelo nome; a ordem é a posição na lista.

-- Vestuário
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Camisetas', 'Camisas', 'Blusas e moletons', 'Casacos e jaquetas', 'Calças',
                  'Bermudas e shorts', 'Roupa íntima e meias', 'Roupa esportiva', 'Pijamas'])
       with ordinality as u(nome, ordem)
where p.nome = 'Vestuário' and p.parent_id is null
on conflict do nothing;

-- Calçados
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Tênis', 'Sapatos', 'Sandálias e chinelos', 'Botas'])
       with ordinality as u(nome, ordem)
where p.nome = 'Calçados' and p.parent_id is null
on conflict do nothing;

-- Acessórios pessoais
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Bonés e chapéus', 'Cintos', 'Relógios', 'Óculos', 'Bolsas e mochilas', 'Carteiras'])
       with ordinality as u(nome, ordem)
where p.nome = 'Acessórios pessoais' and p.parent_id is null
on conflict do nothing;

-- Ferramentas (Acessórios: brocas, discos, lâminas, bits)
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Manuais', 'Elétricas', 'Medição e nivelamento', 'Corte', 'Pintura', 'Hidráulica',
                  'Instalação elétrica', 'Acessórios'])
       with ordinality as u(nome, ordem)
where p.nome = 'Ferramentas' and p.parent_id is null
on conflict do nothing;

-- Ferragens e fixação (consumível)
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'consumivel', u.ordem::int
from categorias p,
     unnest(array['Parafusos', 'Buchas', 'Pregos', 'Porcas e arruelas', 'Abraçadeiras', 'Fitas',
                  'Colas e vedantes'])
       with ordinality as u(nome, ordem)
where p.nome = 'Ferragens e fixação' and p.parent_id is null
on conflict do nothing;

-- Eletrônicos (Pilhas e baterias: consumível)
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id,
       case when u.nome = 'Pilhas e baterias' then 'consumivel' else 'duravel' end,
       u.ordem::int
from categorias p,
     unnest(array['Computadores', 'Celulares e tablets', 'Periféricos', 'Áudio', 'Vídeo e TV',
                  'Armazenamento', 'Rede', 'Componentes', 'Pilhas e baterias'])
       with ordinality as u(nome, ordem)
where p.nome = 'Eletrônicos' and p.parent_id is null
on conflict do nothing;

-- Cabos, carregadores e adaptadores
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Cabos de dados', 'Cabos de vídeo', 'Cabos de rede', 'Cabos de energia e extensões',
                  'Carregadores', 'Adaptadores'])
       with ordinality as u(nome, ordem)
where p.nome = 'Cabos, carregadores e adaptadores' and p.parent_id is null
on conflict do nothing;

-- Eletrodomésticos
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Cozinha', 'Limpeza', 'Climatização', 'Cuidados pessoais'])
       with ordinality as u(nome, ordem)
where p.nome = 'Eletrodomésticos' and p.parent_id is null
on conflict do nothing;

-- Cozinha e utensílios
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Panelas e formas', 'Utensílios', 'Louças', 'Copos e taças', 'Talheres', 'Potes'])
       with ordinality as u(nome, ordem)
where p.nome = 'Cozinha e utensílios' and p.parent_id is null
on conflict do nothing;

-- Cama, mesa e banho
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Roupa de cama', 'Cobertores', 'Toalhas', 'Mesa'])
       with ordinality as u(nome, ordem)
where p.nome = 'Cama, mesa e banho' and p.parent_id is null
on conflict do nothing;

-- Móveis e decoração
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Móveis', 'Iluminação', 'Decoração'])
       with ordinality as u(nome, ordem)
where p.nome = 'Móveis e decoração' and p.parent_id is null
on conflict do nothing;

-- Livros e mídia
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Livros', 'Quadrinhos', 'Mídia física'])
       with ordinality as u(nome, ordem)
where p.nome = 'Livros e mídia' and p.parent_id is null
on conflict do nothing;

-- Esporte e lazer
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Academia', 'Ciclismo', 'Camping', 'Jogos'])
       with ordinality as u(nome, ordem)
where p.nome = 'Esporte e lazer' and p.parent_id is null
on conflict do nothing;

-- Infantil
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Brinquedos', 'Artigos de bebê', 'Material escolar'])
       with ordinality as u(nome, ordem)
where p.nome = 'Infantil' and p.parent_id is null
on conflict do nothing;

-- Automotivo
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Moto', 'Carro', 'Acessórios automotivos'])
       with ordinality as u(nome, ordem)
where p.nome = 'Automotivo' and p.parent_id is null
on conflict do nothing;

-- Jardim e área externa
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Ferramentas de jardim', 'Vasos', 'Irrigação'])
       with ordinality as u(nome, ordem)
where p.nome = 'Jardim e área externa' and p.parent_id is null
on conflict do nothing;

-- Outros
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, 'duravel', u.ordem::int
from categorias p,
     unnest(array['Diversos'])
       with ordinality as u(nome, ordem)
where p.nome = 'Outros' and p.parent_id is null
on conflict do nothing;
