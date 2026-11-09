"use server";

// Leituras do painel lateral do formulário de item. Não alteram dados.
import { ERRO_GENERICO, ERRO_SESSAO, clienteAutenticado } from "@/lib/acoes";
import { UUID_REGEX, corresponde, formatQuantidade } from "@/lib/itens";
import { buscarTodos } from "@/lib/locais-data";
import {
  MAX_BUSCA,
  MIN_BUSCA,
  palavrasSignificativas,
  ranquearLocais,
  type ConteudoLocal,
  type ItemComLocal,
  type RespostaPainel,
  type SugestaoLocal,
} from "@/lib/painel-local";

function uuidOuNull(valor: unknown): string | null | undefined {
  if (valor === null || valor === undefined || valor === "") return null;
  return typeof valor === "string" && UUID_REGEX.test(valor) ? valor : undefined;
}

/** Até 8 locais onde estão itens parecidos com o que está sendo cadastrado. */
export async function sugerirLocais(entrada: {
  categoriaId: string | null;
  nome: string;
  excluirItemId: string | null;
}): Promise<RespostaPainel<SugestaoLocal[]>> {
  const categoriaId = uuidOuNull(entrada?.categoriaId);
  const excluirItemId = uuidOuNull(entrada?.excluirItemId);
  const nome = typeof entrada?.nome === "string" ? entrada.nome.slice(0, 500) : "";
  if (categoriaId === undefined || excluirItemId === undefined) {
    return { ok: false, erro: ERRO_GENERICO };
  }

  const palavras = palavrasSignificativas(nome);
  if (!categoriaId && palavras.length === 0) return { ok: true, dados: [] };

  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false, erro: ERRO_SESSAO };

  try {
    const [categorias, itens, locais] = await Promise.all([
      buscarTodos<{ id: string; parent_id: string | null }>((de, ate) =>
        supabase.from("categorias").select("id, parent_id").order("id").range(de, ate),
      ),
      buscarTodos<{ id: string; nome: string; categoria_id: string; local_id: string }>(
        (de, ate) => {
          let consulta = supabase
            .from("itens")
            .select("id, nome, categoria_id, local_id")
            .not("local_id", "is", null);
          if (excluirItemId) consulta = consulta.neq("id", excluirItemId);
          return consulta.order("id").range(de, ate);
        },
      ),
      buscarTodos<{ id: string; endereco: string; caminho_nomes: string }>((de, ate) =>
        supabase
          .from("locais_enderecos")
          .select("id, endereco, caminho_nomes")
          .order("id")
          .range(de, ate),
      ),
    ]);

    const topoDe = new Map(categorias.map((c) => [c.id, c.parent_id ?? c.id]));
    return {
      ok: true,
      dados: ranquearLocais({ categoriaId, palavras, itens, topoDe, locais }),
    };
  } catch (e) {
    console.error("[db] sugerirLocais:", e);
    return { ok: false, erro: ERRO_GENERICO };
  }
}

/** Itens diretos do local e seus locais filhos, com contagens. */
export async function conteudoLocal(
  localId: string,
  excluirItemId: string | null = null,
): Promise<RespostaPainel<ConteudoLocal>> {
  const id = uuidOuNull(localId);
  const excluir = uuidOuNull(excluirItemId);
  if (!id || excluir === undefined) return { ok: false, erro: ERRO_GENERICO };

  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false, erro: ERRO_SESSAO };

  try {
    const [locais, enderecos, categorias, contagens, diretos] = await Promise.all([
      buscarTodos<{ id: string; parent_id: string | null; codigo: string }>((de, ate) =>
        supabase.from("locais").select("id, parent_id, codigo").order("id").range(de, ate),
      ),
      buscarTodos<{ id: string; endereco: string }>((de, ate) =>
        supabase.from("locais_enderecos").select("id, endereco").order("id").range(de, ate),
      ),
      buscarTodos<{ id: string; nome: string }>((de, ate) =>
        supabase.from("categorias").select("id, nome").order("id").range(de, ate),
      ),
      buscarTodos<{ local_id: string }>((de, ate) => {
        let consulta = supabase
          .from("itens")
          .select("local_id")
          .not("local_id", "is", null);
        if (excluir) consulta = consulta.neq("id", excluir);
        return consulta.order("id").range(de, ate);
      }),
      buscarTodos<{
        id: string;
        nome: string;
        quantidade: number;
        unidade: string;
        categoria_id: string;
      }>((de, ate) => {
        let consulta = supabase
          .from("itens")
          .select("id, nome, quantidade, unidade, categoria_id")
          .eq("local_id", id);
        if (excluir) consulta = consulta.neq("id", excluir);
        return consulta.order("id").range(de, ate);
      }),
    ]);

    if (!locais.some((l) => l.id === id)) return { ok: false, erro: "Local não encontrado." };

    const filhosDe = new Map<string, string[]>();
    for (const l of locais) {
      if (!l.parent_id) continue;
      filhosDe.set(l.parent_id, [...(filhosDe.get(l.parent_id) ?? []), l.id]);
    }
    const diretosPorLocal = new Map<string, number>();
    for (const { local_id } of contagens) {
      diretosPorLocal.set(local_id, (diretosPorLocal.get(local_id) ?? 0) + 1);
    }
    // Itens do local e de toda a subárvore.
    const totalDe = (localId: string, visitados = new Set<string>()): number => {
      if (visitados.has(localId)) return 0;
      visitados.add(localId);
      return (filhosDe.get(localId) ?? []).reduce(
        (soma, filho) => soma + totalDe(filho, visitados),
        diretosPorLocal.get(localId) ?? 0,
      );
    };

    const enderecoDe = new Map(enderecos.map((e) => [e.id, e.endereco]));
    const codigoDe = new Map(locais.map((l) => [l.id, l.codigo]));
    const nomeCategoria = new Map(categorias.map((c) => [c.id, c.nome]));

    return {
      ok: true,
      dados: {
        localId: id,
        endereco: enderecoDe.get(id) ?? codigoDe.get(id) ?? "",
        total: totalDe(id),
        itens: diretos
          .map((i) => ({
            id: i.id,
            nome: i.nome,
            quantidade: formatQuantidade(i.quantidade, i.unidade),
            categoria: nomeCategoria.get(i.categoria_id) ?? "",
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        filhos: (filhosDe.get(id) ?? [])
          .map((filho) => ({
            id: filho,
            codigo: codigoDe.get(filho) ?? "",
            endereco: enderecoDe.get(filho) ?? codigoDe.get(filho) ?? "",
            itens: totalDe(filho),
          }))
          .sort((a, b) => a.endereco.localeCompare(b.endereco, "pt-BR")),
      },
    };
  } catch (e) {
    console.error("[db] conteudoLocal:", e);
    return { ok: false, erro: ERRO_GENERICO };
  }
}

/**
 * Até 10 itens com local cujo nome, marca ou modelo contém todas as palavras do
 * termo (sem distinção de acentos e maiúsculas). Quem casa pelo nome vem antes;
 * depois, ordem alfabética.
 */
export async function buscarItensParaLocal(
  termo: string,
  excluirItemId: string | null = null,
): Promise<RespostaPainel<ItemComLocal[]>> {
  const busca = typeof termo === "string" ? termo.trim().slice(0, 200) : "";
  const excluir = uuidOuNull(excluirItemId);
  if (excluir === undefined) return { ok: false, erro: ERRO_GENERICO };
  if (busca.length < MIN_BUSCA) return { ok: true, dados: [] };

  const supabase = await clienteAutenticado();
  if (!supabase) return { ok: false, erro: ERRO_SESSAO };

  try {
    const [itens, locais] = await Promise.all([
      buscarTodos<{
        id: string;
        nome: string;
        marca: string | null;
        modelo: string | null;
        local_id: string;
      }>((de, ate) => {
        let consulta = supabase
          .from("itens")
          .select("id, nome, marca, modelo, local_id")
          .not("local_id", "is", null);
        if (excluir) consulta = consulta.neq("id", excluir);
        return consulta.order("id").range(de, ate);
      }),
      buscarTodos<{ id: string; endereco: string; caminho_nomes: string }>((de, ate) =>
        supabase
          .from("locais_enderecos")
          .select("id, endereco, caminho_nomes")
          .order("id")
          .range(de, ate),
      ),
    ]);

    const localPorId = new Map(locais.map((l) => [l.id, l]));
    const dados = itens
      .filter((i) => corresponde(busca, i.nome, i.marca ?? "", i.modelo ?? ""))
      .map((i) => ({ item: i, peloNome: corresponde(busca, i.nome) }))
      .sort(
        (a, b) =>
          Number(b.peloNome) - Number(a.peloNome) ||
          a.item.nome.localeCompare(b.item.nome, "pt-BR"),
      )
      .flatMap(({ item }) => {
        const local = localPorId.get(item.local_id);
        return local
          ? [
              {
                id: item.id,
                nome: item.nome,
                localId: local.id,
                endereco: local.endereco,
                caminhoNomes: local.caminho_nomes,
              },
            ]
          : [];
      })
      .slice(0, MAX_BUSCA);
    return { ok: true, dados };
  } catch (e) {
    console.error("[db] buscarItensParaLocal:", e);
    return { ok: false, erro: ERRO_GENERICO };
  }
}
