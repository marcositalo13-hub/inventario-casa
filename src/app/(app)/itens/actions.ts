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
  schemaEfetivo,
  validarItem,
  type AtributoDef,
  type CategoriaRow,
  type ItemInput,
} from "@/lib/itens";

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
