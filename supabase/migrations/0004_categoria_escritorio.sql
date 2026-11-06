-- 0004_categoria_escritorio.sql (idempotente: on conflict do nothing)
-- Nova categoria "Escritório e papelaria" na ordem 17; "Outros" passa para 18.

update categorias
set ordem = 18
where nome = 'Outros' and parent_id is null;

insert into categorias (nome, natureza_padrao, ordem, atributos_schema) values
  ('Escritório e papelaria', 'duravel', 17, '[
    {"chave":"alimentacao","rotulo":"Alimentação","tipo":"lista","opcoes":["pilha","bateria","tomada","usb","nenhuma"]},
    {"chave":"especificacao","rotulo":"Especificação","tipo":"texto"}
  ]'::jsonb)
on conflict do nothing;

-- Escritório e papelaria
insert into categorias (nome, parent_id, natureza_padrao, ordem)
select u.nome, p.id, u.natureza_padrao, u.ordem
from categorias p,
     (values
       ('Equipamentos', 'duravel', 1),
       ('Utensílios', 'duravel', 2),
       ('Suprimentos', 'consumivel', 3)
     ) as u(nome, natureza_padrao, ordem)
where p.nome = 'Escritório e papelaria' and p.parent_id is null
on conflict do nothing;
