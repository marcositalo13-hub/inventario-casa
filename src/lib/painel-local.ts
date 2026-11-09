// Painel lateral do formulário de item: tipos e cálculo das sugestões de local.
// Funções puras, usadas pelas server actions e pelo painel (cliente).
import { normalizar } from "@/lib/itens";

export type RespostaPainel<T> = { ok: true; dados: T } | { ok: false; erro: string };

/** Um local sugerido no modo "Onde estão itens parecidos". */
export type SugestaoLocal = {
  localId: string;
  endereco: string;
  caminhoNomes: string;
  /** Itens do local que pontuaram em algum critério. */
  parecidos: number;
  /** Até 3 nomes, dos mais parecidos para os menos. */
  exemplos: string[];
};

/** Conteúdo direto de um local, para o modo "Conteúdo de {endereço}". */
export type ConteudoLocal = {
  localId: string;
  endereco: string;
  /** Itens do local e de todos os locais dentro dele. */
  total: number;
  itens: { id: string; nome: string; quantidade: string; categoria: string }[];
  /** Locais filhos diretos, com a contagem de itens incluindo os netos. */
  filhos: { id: string; codigo: string; endereco: string; itens: number }[];
};

/** Resultado do modo "Guardar junto de…": um item e o local onde está. */
export type ItemComLocal = {
  id: string;
  nome: string;
  localId: string;
  endereco: string;
  caminhoNomes: string;
};

export const MAX_SUGESTOES = 8;
export const MAX_BUSCA = 10;
/** Caracteres mínimos para buscar em "Guardar junto de…". */
export const MIN_BUSCA = 2;
const MAX_EXEMPLOS = 3;

/** Palavras que não contam como "palavra em comum" entre nomes. */
const STOPWORDS = new Set([
  "com",
  "para",
  "pra",
  "pro",
  "por",
  "pela",
  "pelo",
  "sem",
  "das",
  "dos",
  "nas",
  "nos",
  "aos",
  "uma",
  "umas",
  "uns",
  "que",
  "sobre",
  "entre",
]);

/**
 * Palavras significativas de um nome, sem acentos e em minúsculas, sem repetir:
 * 3 caracteres ou mais e fora da lista de stopwords ("de", "da", "do" já saem
 * pelo tamanho).
 */
export function palavrasSignificativas(nome: string): string[] {
  const palavras = normalizar(nome)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((p) => p.length >= 3 && !STOPWORDS.has(p));
  return [...new Set(palavras)];
}

type ItemParaSugestao = {
  id: string;
  nome: string;
  categoria_id: string;
  local_id: string;
};

type LocalParaSugestao = { id: string; endereco: string; caminho_nomes: string };

const PESO_SUBCATEGORIA = 3;
const PESO_NOME = 2;
const PESO_CATEGORIA = 1;

/**
 * Locais ordenados pela soma dos pontos dos seus itens. Cada item pontua:
 * 3 se tem a mesma categoria escolhida (a subcategoria, ou a categoria de topo
 * quando é ela a escolhida), 1 se tem a mesma categoria de topo, e 2 se o nome
 * tem ao menos uma palavra significativa em comum com o nome digitado.
 */
export function ranquearLocais({
  categoriaId,
  palavras,
  itens,
  topoDe,
  locais,
}: {
  categoriaId: string | null;
  palavras: string[];
  itens: ItemParaSugestao[];
  /** Categoria de topo de cada categoria (a própria, se já é de topo). */
  topoDe: Map<string, string>;
  locais: LocalParaSugestao[];
}): SugestaoLocal[] {
  const buscadas = new Set(palavras);
  const topoEscolhido = categoriaId ? (topoDe.get(categoriaId) ?? categoriaId) : null;

  const porLocal = new Map<string, { pontos: number; itens: { nome: string; pontos: number }[] }>();
  for (const item of itens) {
    let pontos = 0;
    if (categoriaId && item.categoria_id === categoriaId) pontos += PESO_SUBCATEGORIA;
    if (topoEscolhido && topoDe.get(item.categoria_id) === topoEscolhido) {
      pontos += PESO_CATEGORIA;
    }
    if (buscadas.size && palavrasSignificativas(item.nome).some((p) => buscadas.has(p))) {
      pontos += PESO_NOME;
    }
    if (pontos === 0) continue;

    const atual = porLocal.get(item.local_id) ?? { pontos: 0, itens: [] };
    atual.pontos += pontos;
    atual.itens.push({ nome: item.nome, pontos });
    porLocal.set(item.local_id, atual);
  }

  const localPorId = new Map(locais.map((l) => [l.id, l]));
  const resultado: (SugestaoLocal & { pontos: number })[] = [];
  for (const [localId, { pontos, itens: doLocal }] of porLocal) {
    const local = localPorId.get(localId);
    if (!local) continue;
    const exemplos: string[] = [];
    for (const i of [...doLocal].sort(
      (a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, "pt-BR"),
    )) {
      if (!exemplos.includes(i.nome)) exemplos.push(i.nome);
      if (exemplos.length === MAX_EXEMPLOS) break;
    }
    resultado.push({
      localId,
      endereco: local.endereco,
      caminhoNomes: local.caminho_nomes,
      parecidos: doLocal.length,
      exemplos,
      pontos,
    });
  }

  return resultado
    .sort(
      (a, b) =>
        b.pontos - a.pontos ||
        b.parecidos - a.parecidos ||
        a.endereco.localeCompare(b.endereco, "pt-BR"),
    )
    .slice(0, MAX_SUGESTOES)
    .map((s) => ({
      localId: s.localId,
      endereco: s.endereco,
      caminhoNomes: s.caminhoNomes,
      parecidos: s.parecidos,
      exemplos: s.exemplos,
    }));
}
