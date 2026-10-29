// Utilitários compartilhados pelas server actions. Importa next/headers (via
// createClient), portanto só pode ser usado no servidor.
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Resultado = { ok: true } | { ok: false; erro: string };

export const ERRO_GENERICO = "Não foi possível concluir a operação.";
export const ERRO_SESSAO = "Sessão expirada. Entre novamente.";

export async function clienteAutenticado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export type ClienteAutenticado = NonNullable<
  Awaited<ReturnType<typeof clienteAutenticado>>
>;

export function logarErroDb(contexto: string, error: PostgrestError) {
  console.error(`[db] ${contexto}:`, error.code, error.message, error.details);
}

/**
 * Registra o erro no servidor e devolve a mensagem para o usuário conforme o
 * código SQLSTATE; códigos não mapeados viram a mensagem genérica.
 */
export function mensagemErroDb(
  contexto: string,
  error: PostgrestError,
  mensagens: Partial<Record<string, string>>,
): string {
  logarErroDb(contexto, error);
  return mensagens[error.code] ?? ERRO_GENERICO;
}
