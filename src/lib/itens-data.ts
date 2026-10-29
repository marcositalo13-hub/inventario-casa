import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoriaRow, ItemDados } from "@/lib/itens";
import { buscarTodos } from "@/lib/locais-data";

export type PessoaRow = { id: string; nome: string };

export type ItemRow = ItemDados & { id: string };

/** Linha da listagem: só o que a tabela mostra e filtra. */
export type ItemResumo = Pick<
  ItemRow,
  "id" | "nome" | "categoria_id" | "local_id" | "quantidade" | "unidade" | "situacao"
>;

const COLUNAS_ITEM =
  "id, nome, categoria_id, local_id, pessoa_id, natureza, quantidade, unidade, marca, modelo, " +
  "frequencia_uso, estado, situacao, emprestado_para, data_aquisicao, garantia_ate, valor_pago, " +
  "atributos, etiquetas, observacoes";

export async function carregarCategorias(supabase: SupabaseClient): Promise<CategoriaRow[]> {
  return buscarTodos<CategoriaRow>((de, ate) =>
    supabase
      .from("categorias")
      .select("id, nome, parent_id, natureza_padrao, atributos_schema, ordem")
      .order("ordem")
      .order("nome")
      .range(de, ate),
  );
}

export async function carregarPessoas(supabase: SupabaseClient): Promise<PessoaRow[]> {
  return buscarTodos<PessoaRow>((de, ate) =>
    supabase.from("pessoas").select("id, nome").order("nome").range(de, ate),
  );
}

export async function carregarItem(
  supabase: SupabaseClient,
  id: string,
): Promise<ItemRow | null> {
  const { data, error } = await supabase
    .from("itens")
    .select(COLUNAS_ITEM)
    .eq("id", id)
    .maybeSingle<ItemRow>();
  if (error) throw new Error(error.message);
  return data;
}

export async function listarItens(
  supabase: SupabaseClient,
  filtro: { localIds: string[] | null; categoriaIds: string[] | null },
): Promise<ItemResumo[]> {
  return buscarTodos<ItemResumo>((de, ate) => {
    let consulta = supabase
      .from("itens")
      .select("id, nome, categoria_id, local_id, quantidade, unidade, situacao");
    if (filtro.localIds) consulta = consulta.in("local_id", filtro.localIds);
    if (filtro.categoriaIds) consulta = consulta.in("categoria_id", filtro.categoriaIds);
    return consulta.order("id").range(de, ate);
  });
}
