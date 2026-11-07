"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  ERRO_SESSAO,
  clienteAutenticado,
  mensagemErroDb,
  type ClienteAutenticado,
  type Resultado,
} from "@/lib/acoes";
import {
  ESTADOS,
  FREQUENCIAS,
  LIMITE_EM_MASSA,
  SITUACOES,
  UUID_REGEX,
  normalizarEtiquetas,
  schemaEfetivo,
  validarItem,
  type AtributoDef,
  type CategoriaRow,
  type ItemInput,
} from "@/lib/itens";
import { texto } from "@/lib/utils";

const COLUNAS_CATEGORIA = "id, nome, parent_id, natureza_padrao, atributos_schema, ordem";

/** Schema efetivo da categoria (com o do pai), ou null se ela não existir. */
async function schemaDaCategoria(
  supabase: ClienteAutenticado,
  categoriaId: unknown,
): Promise<AtributoDef[] | null> {
  if (typeof categoriaId !== "string") return null;
  const { data: categoria } = await supabase
    .from("categorias")
    .select(COLUNAS_CATEGORIA)
    .eq("id", categoriaId)
    .maybeSingle<CategoriaRow>();
  if (!categoria) return null;

  const porId = new Map([[categoria.id, categoria]]);
  if (categoria.parent_id) {
    const { data: pai } = await supabase
      .from("categorias")
      .select(COLUNAS_CATEGORIA)
      .eq("id", categoria.parent_id)
      .maybeSingle<CategoriaRow>();
    if (pai) porId.set(pai.id, pai);
  }
  return schemaEfetivo(categoria, porId);
}

function erroItem(contexto: string, error: PostgrestError): string {
  return mensagemErroDb(`itens: ${contexto}`, error, {
    "23503": "Categoria, local ou pessoa não encontrados.",
    "23514": "Dados inválidos para o item.",
    "22003": "Número fora do limite permitido.",
  });
}

function revalidar() {
  revalidatePath("/itens", "layout");
  revalidatePath("/locais");
}

async function preparar(input: ItemInput) {
  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false as const, erro: ERRO_SESSAO };

  const schema = await schemaDaCategoria(supabase, input?.categoriaId);
  if (!schema) return { ok: false as const, erro: "Escolha a categoria." };

  const validado = validarItem(input, schema);
  if (!validado.ok) return validado;
  return { ok: true as const, supabase, dados: validado.dados };
}

export async function criarItem(input: ItemInput): Promise<Resultado> {
  const preparado = await preparar(input);
  if (!preparado.ok) return preparado;

  const { error } = await preparado.supabase.from("itens").insert(preparado.dados);
  if (error) return { ok: false, erro: erroItem("criar", error) };

  revalidar();
  return { ok: true };
}

export async function editarItem(id: string, input: ItemInput): Promise<Resultado> {
  if (typeof id !== "string") return { ok: false, erro: "Item não encontrado." };
  const preparado = await preparar(input);
  if (!preparado.ok) return preparado;

  const { data, error } = await preparado.supabase
    .from("itens")
    .update(preparado.dados)
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, erro: erroItem("editar", error) };
  if (!data?.length) return { ok: false, erro: "Item não encontrado." };

  revalidar();
  return { ok: true };
}

export async function excluirItem(id: string): Promise<Resultado> {
  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false, erro: ERRO_SESSAO };
  if (typeof id !== "string") return { ok: false, erro: "Item não encontrado." };

  const { data, error } = await supabase.from("itens").delete().eq("id", id).select("id");
  if (error) return { ok: false, erro: erroItem("excluir", error) };
  if (!data?.length) return { ok: false, erro: "Item não encontrado." };

  revalidar();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Edição em massa (funções das migrações 0006 e 0007)
// ---------------------------------------------------------------------------

export type ResultadoMassa = { ok: true; total: number } | { ok: false; erro: string };

const ERRO_SELECAO = `Selecione de 1 a ${LIMITE_EM_MASSA} itens.`;

const MENSAGENS_MASSA: Partial<Record<string, string>> = {
  P0002: "Algum item selecionado não existe mais. Atualize a página.",
  "23503": "Local, categoria ou pessoa não encontrados.",
  "23514": "Valor inválido para os itens.",
  "22023": "Valor inválido.",
  "22P02": "Valor inválido.",
  PGRST202: "Função de edição em massa ausente no banco. Aplique as migrações 0006 e 0007.",
};

/** Ids únicos, todos UUID, de 1 a LIMITE_EM_MASSA; senão null. */
function validarIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids)) return null;
  if (ids.some((id) => typeof id !== "string" || !UUID_REGEX.test(id))) return null;
  const unicos = [...new Set(ids as string[])];
  return unicos.length >= 1 && unicos.length <= LIMITE_EM_MASSA ? unicos : null;
}

/** Chama a função do banco e devolve o total de itens alterados. */
async function emMassa(
  contexto: string,
  ids: unknown,
  funcao: string,
  argumentos: Record<string, unknown>,
  mensagens: Partial<Record<string, string>> = MENSAGENS_MASSA,
): Promise<ResultadoMassa> {
  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false, erro: ERRO_SESSAO };
  const validos = validarIds(ids);
  if (!validos) return { ok: false, erro: ERRO_SELECAO };

  const { data, error } = await supabase.rpc(funcao, { p_ids: validos, ...argumentos });
  if (error) return { ok: false, erro: mensagemErroDb(`itens: ${contexto}`, error, mensagens) };

  revalidar();
  return { ok: true, total: typeof data === "number" ? data : validos.length };
}

function opcional(valor: unknown): { ok: true; valor: string | null } | { ok: false } {
  if (valor === null) return { ok: true, valor: null };
  return typeof valor === "string" && UUID_REGEX.test(valor)
    ? { ok: true, valor }
    : { ok: false };
}

export async function moverItens(ids: string[], localId: string | null): Promise<ResultadoMassa> {
  const local = opcional(localId);
  if (!local.ok) return { ok: false, erro: "Local inválido." };
  return emMassa("mover", ids, "itens_alterar_campo", {
    p_campo: "local_id",
    p_valor: local.valor,
  });
}

export async function atribuirPessoaItens(
  ids: string[],
  pessoaId: string | null,
): Promise<ResultadoMassa> {
  const pessoa = opcional(pessoaId);
  if (!pessoa.ok) return { ok: false, erro: "Pessoa inválida." };
  return emMassa("atribuir pessoa", ids, "itens_alterar_campo", {
    p_campo: "pessoa_id",
    p_valor: pessoa.valor,
  });
}

export async function alterarSituacaoItens(
  ids: string[],
  situacao: string,
  emprestadoPara: string | null,
): Promise<ResultadoMassa> {
  if (!SITUACOES.some((s) => s.value === situacao)) {
    return { ok: false, erro: "Situação inválida." };
  }
  const destino = situacao === "emprestado" ? texto(emprestadoPara) : null;
  if (situacao === "emprestado" && !destino) {
    return { ok: false, erro: "Informe para quem os itens foram emprestados." };
  }
  return emMassa("alterar situação", ids, "itens_alterar_campo", {
    p_campo: "situacao",
    p_valor: situacao,
    p_emprestado_para: destino,
  });
}

export async function alterarFrequenciaItens(
  ids: string[],
  frequencia: string,
): Promise<ResultadoMassa> {
  if (!FREQUENCIAS.some((f) => f.value === frequencia)) {
    return { ok: false, erro: "Frequência de uso inválida." };
  }
  return emMassa("alterar frequência", ids, "itens_alterar_campo", {
    p_campo: "frequencia_uso",
    p_valor: frequencia,
  });
}

export async function alterarEstadoItens(ids: string[], estado: string): Promise<ResultadoMassa> {
  if (!ESTADOS.some((e) => e.value === estado)) return { ok: false, erro: "Estado inválido." };
  return emMassa("alterar estado", ids, "itens_alterar_campo", {
    p_campo: "estado",
    p_valor: estado,
  });
}

export async function adicionarEtiquetaItens(
  ids: string[],
  etiqueta: string,
): Promise<ResultadoMassa> {
  const valor = normalizarEtiquetas([etiqueta])[0];
  if (!valor) return { ok: false, erro: "Informe a etiqueta." };
  return emMassa("adicionar etiqueta", ids, "itens_adicionar_etiqueta", { p_etiqueta: valor });
}

export async function removerEtiquetaItens(
  ids: string[],
  etiqueta: string,
): Promise<ResultadoMassa> {
  if (typeof etiqueta !== "string" || !etiqueta) return { ok: false, erro: "Etiqueta inválida." };
  return emMassa("remover etiqueta", ids, "itens_remover_etiqueta", { p_etiqueta: etiqueta });
}

const MENSAGENS_CATEGORIA: Partial<Record<string, string>> = {
  ...MENSAGENS_MASSA,
  P0002: "A categoria ou algum item selecionado não existe mais. Atualize a página.",
};

export type PreviaCategoria =
  | { ok: true; removidos: { chave: string; itens: number }[] }
  | { ok: false; erro: string };

/** Atributos que a troca de categoria removeria (só leitura). */
export async function previaAlterarCategoria(
  ids: string[],
  categoriaId: string,
): Promise<PreviaCategoria> {
  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false, erro: ERRO_SESSAO };
  const validos = validarIds(ids);
  if (!validos) return { ok: false, erro: ERRO_SELECAO };
  if (typeof categoriaId !== "string" || !UUID_REGEX.test(categoriaId)) {
    return { ok: false, erro: "Categoria inválida." };
  }

  const { data, error } = await supabase.rpc("itens_preview_alterar_categoria", {
    p_ids: validos,
    p_categoria_id: categoriaId,
  });
  if (error) {
    return { ok: false, erro: mensagemErroDb("itens: prévia categoria", error, MENSAGENS_CATEGORIA) };
  }
  const linhas = (data ?? []) as { chave: string; itens_afetados: number }[];
  return { ok: true, removidos: linhas.map((l) => ({ chave: l.chave, itens: l.itens_afetados })) };
}

export async function alterarCategoriaItens(
  ids: string[],
  categoriaId: string,
): Promise<ResultadoMassa> {
  if (typeof categoriaId !== "string" || !UUID_REGEX.test(categoriaId)) {
    return { ok: false, erro: "Categoria inválida." };
  }
  return emMassa(
    "alterar categoria",
    ids,
    "itens_alterar_categoria",
    { p_categoria_id: categoriaId },
    MENSAGENS_CATEGORIA,
  );
}
