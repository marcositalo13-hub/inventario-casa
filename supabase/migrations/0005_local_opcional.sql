-- 0005_local_opcional.sql
-- Item pode ser cadastrado sem local e receber um depois.

alter table itens alter column local_id drop not null;
