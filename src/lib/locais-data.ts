import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalRow, TipoLocal } from "@/lib/locais";

const PAGINA = 1000;

// O PostgREST limita o número de linhas por resposta; busca em páginas.
async function buscarTodos<T>(
  consulta: (de: number, ate: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const todos: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    todos.push(...(data ?? []));
    if (!data || data.length < PAGINA) return todos;
  }
}

export type DadosLocais = {
  tipos: TipoLocal[];
  locais: LocalRow[];
};

export async function carregarLocais(
  supabase: SupabaseClient,
): Promise<DadosLocais> {
  const [tiposRes, locais, enderecos, itens] = await Promise.all([
    supabase.from("tipos_local").select("sigla, nome, eh_comodo").order("sigla"),
    buscarTodos<Omit<LocalRow, "endereco" | "caminho_nomes" | "itens">>(
      (de, ate) =>
        supabase
          .from("locais")
          .select("id, parent_id, tipo_sigla, numero, codigo, descricao")
          .order("id")
          .range(de, ate),
    ),
    buscarTodos<{ id: string; endereco: string; caminho_nomes: string }>(
      (de, ate) =>
        supabase
          .from("locais_enderecos")
          .select("id, endereco, caminho_nomes")
          .order("id")
          .range(de, ate),
    ),
    buscarTodos<{ local_id: string }>((de, ate) =>
      supabase.from("itens").select("local_id").order("id").range(de, ate),
    ),
  ]);

  if (tiposRes.error) throw new Error(tiposRes.error.message);

  const porId = new Map(enderecos.map((e) => [e.id, e]));
  const contagem = new Map<string, number>();
  for (const { local_id } of itens) {
    contagem.set(local_id, (contagem.get(local_id) ?? 0) + 1);
  }

  return {
    tipos: tiposRes.data ?? [],
    locais: locais.map((l) => ({
      ...l,
      endereco: porId.get(l.id)?.endereco ?? l.codigo,
      caminho_nomes: porId.get(l.id)?.caminho_nomes ?? "",
      itens: contagem.get(l.id) ?? 0,
    })),
  };
}
