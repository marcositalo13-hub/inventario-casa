"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { SIGLA_REGEX, formatCodigo, parseNumero } from "@/lib/locais";

export type Resultado = { ok: true } | { ok: false; erro: string };

const ERRO_GENERICO = "Não foi possível concluir a operação.";
const ERRO_COMBINACAO = "Combinação inválida de tipo e local.";

async function clienteAutenticado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const t = valor.trim();
  return t === "" ? null : t;
}

function logar(contexto: string, error: PostgrestError) {
  console.error(`[locais] ${contexto}:`, error.code, error.message, error.details);
}

/** Mapeia erros do banco em escrita de local. */
function erroLocal(contexto: string, error: PostgrestError, codigo: string): string {
  logar(contexto, error);
  if (error.code === "23505") return `Já existe ${codigo} dentro deste local.`;
  // Exceções do trigger (raise exception), checks e FKs do pai/tipo.
  if (["P0001", "23514", "23503"].includes(error.code)) return ERRO_COMBINACAO;
  return ERRO_GENERICO;
}

async function buscarTipo(
  supabase: NonNullable<Awaited<ReturnType<typeof clienteAutenticado>>>,
  sigla: unknown,
) {
  if (typeof sigla !== "string" || !SIGLA_REGEX.test(sigla)) return null;
  const { data } = await supabase
    .from("tipos_local")
    .select("sigla, eh_comodo")
    .eq("sigla", sigla)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Locais
// ---------------------------------------------------------------------------

export type LocalInput = {
  parentId: string | null;
  tipoSigla: string;
  numero: number | null;
  descricao: string | null;
};

export async function criarLocal(input: LocalInput): Promise<Resultado> {
  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false, erro: "Sessão expirada. Entre novamente." };

  const numero = parseNumero(input?.numero);
  if (!numero.ok) return { ok: false, erro: "Número deve ser um inteiro de 1 a 99." };

  const tipo = await buscarTipo(supabase, input?.tipoSigla);
  if (!tipo) return { ok: false, erro: "Tipo inexistente." };

  const parentId = typeof input.parentId === "string" ? input.parentId : null;
  if (tipo.eh_comodo !== (parentId === null)) return { ok: false, erro: ERRO_COMBINACAO };

  const { error } = await supabase.from("locais").insert({
    parent_id: parentId,
    tipo_sigla: tipo.sigla,
    numero: numero.numero,
    descricao: texto(input.descricao),
  });
  if (error) {
    return { ok: false, erro: erroLocal("criar", error, formatCodigo(tipo.sigla, numero.numero)) };
  }

  revalidatePath("/locais");
  return { ok: true };
}

export type LocalEdicao = {
  id: string;
  tipoSigla: string;
  numero: number | null;
  descricao: string | null;
};

export async function editarLocal(input: LocalEdicao): Promise<Resultado> {
  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false, erro: "Sessão expirada. Entre novamente." };

  if (typeof input?.id !== "string") return { ok: false, erro: "Local não encontrado." };

  const numero = parseNumero(input.numero);
  if (!numero.ok) return { ok: false, erro: "Número deve ser um inteiro de 1 a 99." };

  const tipo = await buscarTipo(supabase, input.tipoSigla);
  if (!tipo) return { ok: false, erro: "Tipo inexistente." };

  const { data: atual } = await supabase
    .from("locais")
    .select("parent_id")
    .eq("id", input.id)
    .maybeSingle();
  if (!atual) return { ok: false, erro: "Local não encontrado." };
  if (tipo.eh_comodo !== (atual.parent_id === null)) return { ok: false, erro: ERRO_COMBINACAO };

  // parent_id nunca é alterado aqui (mover fica para outro momento).
  const { error } = await supabase
    .from("locais")
    .update({
      tipo_sigla: tipo.sigla,
      numero: numero.numero,
      descricao: texto(input.descricao),
    })
    .eq("id", input.id);
  if (error) {
    return { ok: false, erro: erroLocal("editar", error, formatCodigo(tipo.sigla, numero.numero)) };
  }

  revalidatePath("/locais");
  return { ok: true };
}

export async function excluirLocal(id: string): Promise<Resultado> {
  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false, erro: "Sessão expirada. Entre novamente." };
  if (typeof id !== "string") return { ok: false, erro: "Local não encontrado." };

  const { data, error } = await supabase.from("locais").delete().eq("id", id).select("id");
  if (error) {
    logar("excluir", error);
    if (error.code === "23503") {
      return { ok: false, erro: "Não é possível excluir: há locais ou itens dentro deste." };
    }
    return { ok: false, erro: ERRO_GENERICO };
  }
  if (!data?.length) return { ok: false, erro: "Local não encontrado." };

  revalidatePath("/locais");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Siglas (tipos_local)
// ---------------------------------------------------------------------------

export type SiglaInput = { sigla: string; nome: string; ehComodo: boolean };

export async function criarSigla(input: SiglaInput): Promise<Resultado> {
  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false, erro: "Sessão expirada. Entre novamente." };

  const sigla = typeof input?.sigla === "string" ? input.sigla.trim().toUpperCase() : "";
  if (!SIGLA_REGEX.test(sigla)) {
    return { ok: false, erro: "Sigla deve ter de 2 a 4 letras maiúsculas (A–Z)." };
  }
  const nome = texto(input.nome);
  if (!nome) return { ok: false, erro: "Informe o nome." };

  const { error } = await supabase
    .from("tipos_local")
    .insert({ sigla, nome, eh_comodo: input.ehComodo === true });
  if (error) {
    logar("criar sigla", error);
    if (error.code === "23505") return { ok: false, erro: `Já existe a sigla ${sigla}.` };
    if (error.code === "23514") {
      return { ok: false, erro: "Sigla deve ter de 2 a 4 letras maiúsculas (A–Z)." };
    }
    return { ok: false, erro: ERRO_GENERICO };
  }

  revalidatePath("/locais");
  return { ok: true };
}

export async function editarSigla(input: { sigla: string; nome: string }): Promise<Resultado> {
  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false, erro: "Sessão expirada. Entre novamente." };

  if (typeof input?.sigla !== "string") return { ok: false, erro: "Sigla não encontrada." };
  const nome = texto(input.nome);
  if (!nome) return { ok: false, erro: "Informe o nome." };

  // Só o nome é editável; a sigla é a chave.
  const { data, error } = await supabase
    .from("tipos_local")
    .update({ nome })
    .eq("sigla", input.sigla)
    .select("sigla");
  if (error) {
    logar("editar sigla", error);
    return { ok: false, erro: ERRO_GENERICO };
  }
  if (!data?.length) return { ok: false, erro: "Sigla não encontrada." };

  revalidatePath("/locais");
  return { ok: true };
}

export async function excluirSigla(sigla: string): Promise<Resultado> {
  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false, erro: "Sessão expirada. Entre novamente." };
  if (typeof sigla !== "string") return { ok: false, erro: "Sigla não encontrada." };

  const { data, error } = await supabase
    .from("tipos_local")
    .delete()
    .eq("sigla", sigla)
    .select("sigla");
  if (error) {
    logar("excluir sigla", error);
    if (error.code === "23503") {
      const { count } = await supabase
        .from("locais")
        .select("id", { count: "exact", head: true })
        .eq("tipo_sigla", sigla);
      const n = count ?? 0;
      return { ok: false, erro: `Sigla em uso por ${n} ${n === 1 ? "local" : "locais"}.` };
    }
    return { ok: false, erro: ERRO_GENERICO };
  }
  if (!data?.length) return { ok: false, erro: "Sigla não encontrada." };

  revalidatePath("/locais");
  return { ok: true };
}
