// Funções puras de itens: domínios, categorias, números pt-BR e validação.
// Usadas pelo formulário (cliente) e pelas server actions.
import { texto } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Domínios (valores do banco → rótulos pt-BR)
// ---------------------------------------------------------------------------

type Opcao<T extends string> = { value: T; label: string };

export const FREQUENCIAS = [
  { value: "diario", label: "diário" },
  { value: "semanal", label: "semanal" },
  { value: "mensal", label: "mensal" },
  { value: "raro", label: "raro" },
  { value: "sazonal", label: "sazonal" },
] as const satisfies readonly Opcao<string>[];

export const ESTADOS = [
  { value: "novo", label: "novo" },
  { value: "bom", label: "bom" },
  { value: "desgastado", label: "desgastado" },
  { value: "com_defeito", label: "com defeito" },
] as const satisfies readonly Opcao<string>[];

export const SITUACOES = [
  { value: "em_uso", label: "em uso" },
  { value: "guardado", label: "guardado" },
  { value: "emprestado", label: "emprestado" },
  { value: "para_doar", label: "para doar" },
  { value: "para_descartar", label: "para descartar" },
] as const satisfies readonly Opcao<string>[];

export const NATUREZAS = [
  { value: "duravel", label: "durável" },
  { value: "consumivel", label: "consumível" },
] as const satisfies readonly Opcao<string>[];

export type Frequencia = (typeof FREQUENCIAS)[number]["value"];
export type Estado = (typeof ESTADOS)[number]["value"];
export type Situacao = (typeof SITUACOES)[number]["value"];
export type Natureza = (typeof NATUREZAS)[number]["value"];

export function rotulo(opcoes: readonly Opcao<string>[], valor: string | null): string {
  return opcoes.find((o) => o.value === valor)?.label ?? "";
}

function pertence<T extends string>(
  opcoes: readonly Opcao<T>[],
  valor: unknown,
): valor is T {
  return opcoes.some((o) => o.value === valor);
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export type TipoAtributo = "texto" | "numero" | "lista" | "multilista" | "booleano";

export type AtributoDef = {
  chave: string;
  rotulo: string;
  tipo: TipoAtributo;
  opcoes?: string[];
};

export type CategoriaRow = {
  id: string;
  nome: string;
  parent_id: string | null;
  natureza_padrao: Natureza;
  atributos_schema: AtributoDef[];
  ordem: number;
};

/** "Subcategoria · Categoria" para subcategorias; só o nome no topo. */
export function rotuloCategoria(
  categoria: CategoriaRow,
  porId: Map<string, CategoriaRow>,
): string {
  const pai = categoria.parent_id ? porId.get(categoria.parent_id) : undefined;
  return pai ? `${categoria.nome} · ${pai.nome}` : categoria.nome;
}

/** Schema do pai + o próprio; em chave repetida vale a definição da subcategoria. */
export function schemaEfetivo(
  categoria: CategoriaRow,
  porId: Map<string, CategoriaRow>,
): AtributoDef[] {
  const pai = categoria.parent_id ? porId.get(categoria.parent_id) : undefined;
  const proprios = new Map(categoria.atributos_schema.map((a) => [a.chave, a]));
  const herdados = (pai?.atributos_schema ?? []).map(
    (a) => proprios.get(a.chave) ?? a,
  );
  const chavesHerdadas = new Set(herdados.map((a) => a.chave));
  return [
    ...herdados,
    ...categoria.atributos_schema.filter((a) => !chavesHerdadas.has(a.chave)),
  ];
}

export function naturezaDaCategoria(
  categoria: CategoriaRow,
  porId: Map<string, CategoriaRow>,
): Natureza {
  const pai = categoria.parent_id ? porId.get(categoria.parent_id) : undefined;
  return categoria.natureza_padrao ?? pai?.natureza_padrao ?? "duravel";
}

/** Ids da categoria e de suas subcategorias (diretas). */
export function idsCategoriaComSubs(id: string, categorias: CategoriaRow[]): string[] {
  return [id, ...categorias.filter((c) => c.parent_id === id).map((c) => c.id)];
}

// ---------------------------------------------------------------------------
// Texto e números
// ---------------------------------------------------------------------------

/** Minúsculas e sem acentos, para busca. */
export function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Todas as palavras da busca aparecem em algum dos textos. */
export function corresponde(busca: string, ...textos: string[]): boolean {
  const alvo = normalizar(textos.join(" "));
  return normalizar(busca)
    .split(/\s+/)
    .filter(Boolean)
    .every((termo) => alvo.includes(termo));
}

/**
 * Número em formato pt-BR: "1.234,56", "1234,56", "0,5". Sem vírgula, um ponto
 * seguido de grupos de 3 dígitos é milhar ("1.234"); senão é decimal ("1.5").
 * Vazio → null.
 */
export function parseDecimalBR(
  valor: unknown,
): { ok: true; numero: number | null } | { ok: false } {
  if (valor === null || valor === undefined) return { ok: true, numero: null };
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? { ok: true, numero: valor } : { ok: false };
  }
  if (typeof valor !== "string") return { ok: false };
  const t = valor.trim().replace(/\s/g, "");
  if (t === "") return { ok: true, numero: null };

  let normal: string;
  if (t.includes(",")) {
    if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(t)) return { ok: false };
    normal = t.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    normal = t.replace(/\./g, "");
  } else {
    if (!/^-?\d+(\.\d+)?$/.test(t)) return { ok: false };
    normal = t;
  }
  const n = Number(normal);
  return Number.isFinite(n) ? { ok: true, numero: n } : { ok: false };
}

/** Número para exibir/editar em pt-BR, sem separador de milhar. */
export function formatDecimalBR(valor: number | null, casas?: number): string {
  if (valor == null) return "";
  return valor.toLocaleString("pt-BR", {
    useGrouping: false,
    minimumFractionDigits: casas ?? 0,
    maximumFractionDigits: casas ?? 3,
  });
}

/** Valor monetário para exibir/editar: "1.234,56". */
export function formatMoedaBR(valor: number | null): string {
  if (valor == null) return "";
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatQuantidade(quantidade: number, unidade: string): string {
  return `${formatDecimalBR(quantidade)} ${unidade}`;
}

// ---------------------------------------------------------------------------
// Atributos
// ---------------------------------------------------------------------------

export type Atributos = Record<string, string | number | boolean | string[]>;

/**
 * Valida atributos contra o schema efetivo: descarta chaves desconhecidas e
 * valores vazios, converte tipos e exige que lista/multilista usem as opções.
 * Booleano é gravado só quando verdadeiro (a caixa desmarcada não distingue
 * "não" de "não informado").
 */
export function validarAtributos(
  schema: AtributoDef[],
  bruto: unknown,
): { ok: true; atributos: Atributos } | { ok: false; erro: string } {
  const entrada =
    bruto && typeof bruto === "object" && !Array.isArray(bruto)
      ? (bruto as Record<string, unknown>)
      : {};
  const atributos: Atributos = {};

  for (const def of schema) {
    const v = entrada[def.chave];
    if (v === undefined || v === null) continue;

    switch (def.tipo) {
      case "texto": {
        if (typeof v !== "string") return { ok: false, erro: `${def.rotulo}: valor inválido.` };
        const t = v.trim();
        if (t) atributos[def.chave] = t;
        break;
      }
      case "numero": {
        const n = parseDecimalBR(v);
        if (!n.ok) return { ok: false, erro: `${def.rotulo} deve ser um número.` };
        if (n.numero != null) atributos[def.chave] = n.numero;
        break;
      }
      case "lista": {
        if (v === "") break;
        if (typeof v !== "string" || !def.opcoes?.includes(v)) {
          return { ok: false, erro: `${def.rotulo}: opção inválida.` };
        }
        atributos[def.chave] = v;
        break;
      }
      case "multilista": {
        if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !def.opcoes?.includes(x))) {
          return { ok: false, erro: `${def.rotulo}: opção inválida.` };
        }
        const unicos = def.opcoes!.filter((o) => v.includes(o));
        if (unicos.length) atributos[def.chave] = unicos;
        break;
      }
      case "booleano": {
        if (v === true || v === "true") atributos[def.chave] = true;
        else if (v !== false && v !== "false") {
          return { ok: false, erro: `${def.rotulo}: valor inválido.` };
        }
        break;
      }
    }
  }
  return { ok: true, atributos };
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

/** O que o formulário envia: textos crus, o servidor converte e valida. */
export type ItemInput = {
  nome: string;
  categoriaId: string;
  localId: string;
  quantidade: string;
  unidade: string;
  marca: string;
  modelo: string;
  pessoaId: string | null;
  frequenciaUso: string | null;
  estado: string | null;
  situacao: string;
  emprestadoPara: string;
  natureza: string;
  dataAquisicao: string;
  garantiaAte: string;
  valorPago: string;
  etiquetas: string[];
  observacoes: string;
  atributos: Record<string, unknown>;
};

/** Colunas de itens prontas para insert/update. */
export type ItemDados = {
  nome: string;
  categoria_id: string;
  local_id: string;
  pessoa_id: string | null;
  natureza: Natureza;
  quantidade: number;
  unidade: string;
  marca: string | null;
  modelo: string | null;
  frequencia_uso: Frequencia | null;
  estado: Estado | null;
  situacao: Situacao;
  emprestado_para: string | null;
  data_aquisicao: string | null;
  garantia_ate: string | null;
  valor_pago: number | null;
  atributos: Atributos;
  etiquetas: string[];
  observacoes: string | null;
};

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function data(valor: unknown): { ok: true; data: string | null } | { ok: false } {
  const t = texto(valor);
  if (t == null) return { ok: true, data: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return { ok: false };
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(t)
    ? { ok: true, data: t }
    : { ok: false };
}

/** Etiquetas aparadas, sem vazias nem repetidas (ignorando maiúsculas). */
export function normalizarEtiquetas(valores: unknown): string[] {
  if (!Array.isArray(valores)) return [];
  const vistas = new Set<string>();
  const resultado: string[] = [];
  for (const v of valores) {
    const t = texto(v);
    if (t && !vistas.has(t.toLowerCase())) {
      vistas.add(t.toLowerCase());
      resultado.push(t);
    }
  }
  return resultado;
}

/**
 * Valida o item. `schema` é o schema efetivo da categoria escolhida (já
 * conferida no banco pelo chamador).
 */
export function validarItem(
  input: ItemInput,
  schema: AtributoDef[],
): { ok: true; dados: ItemDados } | { ok: false; erro: string } {
  const nome = texto(input?.nome);
  if (!nome) return { ok: false, erro: "Informe o nome." };

  const categoriaId = texto(input.categoriaId);
  if (!categoriaId || !UUID_REGEX.test(categoriaId)) return { ok: false, erro: "Escolha a categoria." };

  const localId = texto(input.localId);
  if (!localId || !UUID_REGEX.test(localId)) return { ok: false, erro: "Escolha o local." };

  const quantidade = parseDecimalBR(input.quantidade);
  if (!quantidade.ok || quantidade.numero == null) {
    return { ok: false, erro: "Informe a quantidade." };
  }
  if (quantidade.numero < 0) return { ok: false, erro: "Quantidade não pode ser negativa." };
  if (quantidade.numero >= 1e9) return { ok: false, erro: "Quantidade muito grande." };

  const unidade = texto(input.unidade);
  if (!unidade) return { ok: false, erro: "Informe a unidade." };

  const pessoaId = texto(input.pessoaId);
  if (pessoaId && !UUID_REGEX.test(pessoaId)) return { ok: false, erro: "Pessoa inválida." };

  const frequencia = texto(input.frequenciaUso);
  if (frequencia && !pertence(FREQUENCIAS, frequencia)) {
    return { ok: false, erro: "Frequência de uso inválida." };
  }
  const estado = texto(input.estado);
  if (estado && !pertence(ESTADOS, estado)) return { ok: false, erro: "Estado inválido." };

  const situacao = texto(input.situacao) ?? "guardado";
  if (!pertence(SITUACOES, situacao)) return { ok: false, erro: "Situação inválida." };

  const emprestadoPara = situacao === "emprestado" ? texto(input.emprestadoPara) : null;
  if (situacao === "emprestado" && !emprestadoPara) {
    return { ok: false, erro: "Informe para quem o item foi emprestado." };
  }

  const natureza = texto(input.natureza);
  if (!pertence(NATUREZAS, natureza)) return { ok: false, erro: "Natureza inválida." };

  const aquisicao = data(input.dataAquisicao);
  if (!aquisicao.ok) return { ok: false, erro: "Data de aquisição inválida." };
  const garantia = data(input.garantiaAte);
  if (!garantia.ok) return { ok: false, erro: "Data de garantia inválida." };

  const valor = parseDecimalBR(input.valorPago);
  if (!valor.ok) return { ok: false, erro: "Valor pago inválido. Use o formato 1.234,56." };
  if (valor.numero != null && valor.numero < 0) {
    return { ok: false, erro: "Valor pago não pode ser negativo." };
  }
  if (valor.numero != null && valor.numero >= 1e10) {
    return { ok: false, erro: "Valor pago muito grande." };
  }

  const atributos = validarAtributos(schema, input.atributos);
  if (!atributos.ok) return atributos;

  return {
    ok: true,
    dados: {
      nome,
      categoria_id: categoriaId,
      local_id: localId,
      pessoa_id: pessoaId,
      natureza,
      quantidade: quantidade.numero,
      unidade,
      marca: texto(input.marca),
      modelo: texto(input.modelo),
      frequencia_uso: frequencia as Frequencia | null,
      estado: estado as Estado | null,
      situacao,
      emprestado_para: emprestadoPara,
      data_aquisicao: aquisicao.data,
      garantia_ate: garantia.data,
      valor_pago: valor.numero == null ? null : Math.round(valor.numero * 100) / 100,
      atributos: atributos.atributos,
      etiquetas: normalizarEtiquetas(input.etiquetas),
      observacoes: texto(input.observacoes),
    },
  };
}
