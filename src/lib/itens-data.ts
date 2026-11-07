import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoriaRow, ItemDados } from "@/lib/itens";
import { buscarTodos } from "@/lib/locais-data";

export type PessoaRow = { id: string; nome: string };

export type ItemRow = ItemDados & { id: string };

/** Linha da listagem: só o que a tabela mostra, busca e ordena. */
export type ItemResumo = Pick<
  ItemRow,
  | "id"
  | "nome"
  | "categoria_id"
  | "local_id"
  | "quantidade"
  | "unidade"
  | "situacao"
  | "marca"
  | "modelo"
  | "observacoes"
> & { created_at: string; updated_at: string };

/** Filtros aplicados no banco; listas vazias e null não filtram. */
export type FiltroListagem = {
  localIds: string[] | null;
  semLocal: boolean;
  categoriaIds: string[] | null;
  situacoes: string[];
  frequencias: string[];
  estados: string[];
  /** Casa itens com qualquer uma das etiquetas. */
  etiquetas: string[];
  pessoaId: string | null;
  natureza: string | null;
  /** Sem local, sem frequência de uso ou sem estado. */
  incompletos: boolean;
};

/** Literal de array do Postgres, com aspas, para valores com vírgula ou chaves. */
function literalArray(valores: string[]): string {
  const elementos = valores.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  return `{${elementos.join(",")}}`;
}

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

export async function contarItensSemLocal(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("itens")
    .select("id", { count: "exact", head: true })
    .is("local_id", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listarItens(
  supabase: SupabaseClient,
  filtro: FiltroListagem,
): Promise<ItemResumo[]> {
  return buscarTodos<ItemResumo>((de, ate) => {
    let consulta = supabase
      .from("itens")
      .select(
        "id, nome, categoria_id, local_id, quantidade, unidade, situacao, marca, modelo, observacoes, created_at, updated_at",
      );
    if (filtro.semLocal) consulta = consulta.is("local_id", null);
    else if (filtro.localIds) consulta = consulta.in("local_id", filtro.localIds);
    if (filtro.categoriaIds) consulta = consulta.in("categoria_id", filtro.categoriaIds);
    if (filtro.situacoes.length) consulta = consulta.in("situacao", filtro.situacoes);
    if (filtro.frequencias.length) consulta = consulta.in("frequencia_uso", filtro.frequencias);
    if (filtro.estados.length) consulta = consulta.in("estado", filtro.estados);
    if (filtro.etiquetas.length) {
      consulta = consulta.overlaps("etiquetas", literalArray(filtro.etiquetas));
    }
    if (filtro.pessoaId) consulta = consulta.eq("pessoa_id", filtro.pessoaId);
    if (filtro.natureza) consulta = consulta.eq("natureza", filtro.natureza);
    if (filtro.incompletos) {
      consulta = consulta.or("local_id.is.null,frequencia_uso.is.null,estado.is.null");
    }
    return consulta.order("id").range(de, ate);
  });
}

/** Etiquetas distintas usadas nos itens, em ordem alfabética. */
export async function carregarEtiquetas(supabase: SupabaseClient): Promise<string[]> {
  const linhas = await buscarTodos<{ etiquetas: string[] | null }>((de, ate) =>
    supabase
      .from("itens")
      .select("etiquetas")
      .not("etiquetas", "eq", "{}")
      .order("id")
      .range(de, ate),
  );
  const unicas = new Set(linhas.flatMap((l) => l.etiquetas ?? []));
  return [...unicas].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
