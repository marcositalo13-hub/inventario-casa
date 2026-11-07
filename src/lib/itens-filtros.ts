// Filtros e ordenação da lista de itens, guardados na URL. Funções puras,
// usadas pela página (servidor) e pela barra de filtros (cliente).
import {
  ESTADOS,
  FREQUENCIAS,
  NATUREZAS,
  SEM_LOCAL,
  SITUACOES,
  UUID_REGEX,
  type Estado,
  type Frequencia,
  type Natureza,
  type Situacao,
} from "@/lib/itens";

export const COLUNAS_ORDEM = ["nome", "categoria", "endereco", "qtd", "cadastrado", "atualizado"] as const;
export type ColunaOrdem = (typeof COLUNAS_ORDEM)[number];
export type Direcao = "asc" | "desc";

export type Filtros = {
  q: string;
  /** Id do local, SEM_LOCAL ou null. */
  local: string | null;
  categoria: string | null;
  situacao: Situacao[];
  frequencia: Frequencia[];
  estado: Estado[];
  etiquetas: string[];
  pessoa: string | null;
  natureza: Natureza | null;
  incompletos: boolean;
  ordem: ColunaOrdem;
  dir: Direcao;
};

/** Padrão: os cadastrados mais recentemente primeiro. */
export const ORDEM_PADRAO = { ordem: "cadastrado", dir: "desc" } as const satisfies {
  ordem: ColunaOrdem;
  dir: Direcao;
};

/** Direção inicial ao clicar numa coluna: datas começam pelas mais recentes. */
export function direcaoInicial(coluna: ColunaOrdem): Direcao {
  return coluna === "atualizado" || coluna === "cadastrado" ? "desc" : "asc";
}

export const FILTROS_VAZIOS: Filtros = {
  q: "",
  local: null,
  categoria: null,
  situacao: [],
  frequencia: [],
  estado: [],
  etiquetas: [],
  pessoa: null,
  natureza: null,
  incompletos: false,
  ...ORDEM_PADRAO,
};

type Params = Record<string, string | string[] | undefined>;

function valores(params: Params, chave: string): string[] {
  const v = params[chave];
  const lista = Array.isArray(v) ? v : v === undefined ? [] : [v];
  return [...new Set(lista.map((x) => x.trim()).filter(Boolean))];
}

function primeiro(params: Params, chave: string): string | null {
  return valores(params, chave)[0] ?? null;
}

function doDominio<T extends string>(
  opcoes: readonly { value: T }[],
  lista: string[],
): T[] {
  // Mantém a ordem do domínio, não a da URL.
  return opcoes.map((o) => o.value).filter((v) => lista.includes(v));
}

function uuid(valor: string | null): string | null {
  return valor && UUID_REGEX.test(valor) ? valor : null;
}

/**
 * Lê os filtros da URL, descartando valores fora do domínio. A existência de
 * local, categoria e pessoa é conferida pela página.
 */
export function lerFiltros(params: Params): Filtros {
  const local = primeiro(params, "local");
  const natureza = doDominio(NATUREZAS, valores(params, "natureza"))[0] ?? null;
  const ordem = primeiro(params, "ordem");
  const colunaValida = COLUNAS_ORDEM.find((c) => c === ordem);
  const dir = primeiro(params, "dir");

  return {
    q: primeiro(params, "q") ?? "",
    local: local === SEM_LOCAL ? SEM_LOCAL : uuid(local),
    categoria: uuid(primeiro(params, "categoria")),
    situacao: doDominio(SITUACOES, valores(params, "situacao")),
    frequencia: doDominio(FREQUENCIAS, valores(params, "frequencia")),
    estado: doDominio(ESTADOS, valores(params, "estado")),
    etiquetas: valores(params, "etiqueta"),
    pessoa: uuid(primeiro(params, "pessoa")),
    natureza,
    incompletos: primeiro(params, "incompletos") === "1",
    ordem: colunaValida ?? ORDEM_PADRAO.ordem,
    dir: colunaValida ? (dir === "desc" ? "desc" : dir === "asc" ? "asc" : direcaoInicial(colunaValida)) : ORDEM_PADRAO.dir,
  };
}

/** Query string dos filtros; valores padrão ficam de fora. */
export function paramsDosFiltros(f: Filtros): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.local) p.set("local", f.local);
  if (f.categoria) p.set("categoria", f.categoria);
  for (const v of f.situacao) p.append("situacao", v);
  for (const v of f.frequencia) p.append("frequencia", v);
  for (const v of f.estado) p.append("estado", v);
  for (const v of f.etiquetas) p.append("etiqueta", v);
  if (f.pessoa) p.set("pessoa", f.pessoa);
  if (f.natureza) p.set("natureza", f.natureza);
  if (f.incompletos) p.set("incompletos", "1");
  if (f.ordem !== ORDEM_PADRAO.ordem || f.dir !== ORDEM_PADRAO.dir) {
    p.set("ordem", f.ordem);
    p.set("dir", f.dir);
  }
  return p;
}

export function hrefItens(f: Filtros): string {
  const busca = paramsDosFiltros(f).toString();
  return busca ? `/itens?${busca}` : "/itens";
}

/**
 * Href de volta para a lista a partir do parâmetro "voltar" (a query string da
 * lista). A query é relida como filtros e remontada, então o resultado é sempre
 * /itens com parâmetros conhecidos: outros caminhos e URLs externas não passam.
 */
export function hrefVoltar(voltar: string | string[] | undefined): string {
  const bruto = Array.isArray(voltar) ? voltar[0] : voltar;
  if (!bruto || bruto.length > 4000) return "/itens";
  const params: Params = {};
  for (const [chave, valor] of new URLSearchParams(bruto)) {
    const atual = params[chave];
    params[chave] = atual === undefined ? valor : [...(Array.isArray(atual) ? atual : [atual]), valor];
  }
  return hrefItens(lerFiltros(params));
}

/** Algum filtro ativo (a ordenação não conta). */
export function temFiltroAtivo(f: Filtros): boolean {
  return Boolean(
    f.q.trim() ||
      f.local ||
      f.categoria ||
      f.situacao.length ||
      f.frequencia.length ||
      f.estado.length ||
      f.etiquetas.length ||
      f.pessoa ||
      f.natureza ||
      f.incompletos,
  );
}

/** Mesmos filtros, sem nenhum filtro ativo, mantendo a ordenação. */
export function semFiltros(f: Filtros): Filtros {
  return { ...FILTROS_VAZIOS, ordem: f.ordem, dir: f.dir };
}

/** Href do cabeçalho: alterna a direção na coluna atual, ou começa na nova. */
export function hrefOrdenacao(f: Filtros, coluna: ColunaOrdem): string {
  const dir: Direcao =
    f.ordem === coluna ? (f.dir === "asc" ? "desc" : "asc") : direcaoInicial(coluna);
  return hrefItens({ ...f, ordem: coluna, dir });
}

// ---------------------------------------------------------------------------
// Tempo relativo
// ---------------------------------------------------------------------------

const relativo = new Intl.RelativeTimeFormat("pt-BR", { numeric: "always" });

/** "há 2 dias", "há 3 horas"; menos de um minuto vira "agora". */
export function tempoRelativo(iso: string, agora: number): string {
  const segundos = Math.round((agora - Date.parse(iso)) / 1000);
  if (Number.isNaN(segundos)) return "";
  if (segundos < 60) return "agora";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return relativo.format(-minutos, "minute");
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return relativo.format(-horas, "hour");
  const dias = Math.floor(horas / 24);
  if (dias < 30) return relativo.format(-dias, "day");
  const meses = Math.floor(dias / 30);
  if (meses < 12) return relativo.format(-meses, "month");
  return relativo.format(-Math.floor(dias / 365), "year");
}

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function formatDataHora(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "" : dataHora.format(t);
}
