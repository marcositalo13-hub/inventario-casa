// Funções puras para a árvore de locais. Sem dependências de servidor ou cliente.

export type TipoLocal = {
  sigla: string;
  nome: string;
  eh_comodo: boolean;
};

export type LocalRow = {
  id: string;
  parent_id: string | null;
  tipo_sigla: string;
  numero: number | null;
  codigo: string;
  descricao: string | null;
  endereco: string;
  caminho_nomes: string;
  itens: number;
};

export type LocalNode = LocalRow & {
  nome: string;
  depth: number;
  children: LocalNode[];
};

export const SIGLA_REGEX = /^[A-Z]{2,4}$/;

/** Mesmo cálculo da coluna gerada locais.codigo. */
export function formatCodigo(sigla: string, numero: number | null): string {
  return numero == null ? sigla : `${sigla}-${String(numero).padStart(2, "0")}`;
}

/** "Gaveta 01", "Armário". */
export function nomeLocal(tipoNome: string, numero: number | null): string {
  return numero == null
    ? tipoNome
    : `${tipoNome} ${String(numero).padStart(2, "0")}`;
}

/**
 * Endereço completo de um novo local, seguindo a regra da view locais_enderecos:
 * cômodo → só o código; filho direto do cômodo → "QRT-01 ARM";
 * demais níveis → endereço do pai + "-" + código.
 */
export function enderecoFilho(
  parent: Pick<LocalRow, "endereco" | "parent_id"> | null,
  codigo: string,
): string {
  if (!parent) return codigo;
  return parent.parent_id === null
    ? `${parent.endereco} ${codigo}`
    : `${parent.endereco}-${codigo}`;
}

/** Próximo número para o tipo dentro do pai: max + 1, ou null se não houver. */
export function proximoNumero(
  locais: Pick<LocalRow, "parent_id" | "tipo_sigla" | "numero">[],
  parentId: string | null,
  sigla: string,
): number | null {
  let max: number | null = null;
  for (const l of locais) {
    if (l.parent_id === parentId && l.tipo_sigla === sigla && l.numero != null) {
      max = max == null ? l.numero : Math.max(max, l.numero);
    }
  }
  if (max == null || max >= 99) return null;
  return max + 1;
}

/** Valida o número de um local: inteiro 1–99 ou vazio (null). */
export function parseNumero(
  valor: unknown,
): { ok: true; numero: number | null } | { ok: false } {
  if (valor === null || valor === undefined || valor === "") {
    return { ok: true, numero: null };
  }
  const n = typeof valor === "number" ? valor : Number(String(valor).trim());
  if (!Number.isInteger(n) || n < 1 || n > 99) return { ok: false };
  return { ok: true, numero: n };
}

/** Ids do local e de todos os seus descendentes. */
export function idsComDescendentes(
  id: string,
  locais: Pick<LocalRow, "id" | "parent_id">[],
): string[] {
  const filhos = new Map<string, string[]>();
  for (const l of locais) {
    if (l.parent_id) filhos.set(l.parent_id, [...(filhos.get(l.parent_id) ?? []), l.id]);
  }
  const ids: string[] = [];
  const pilha = [id];
  while (pilha.length) {
    const atual = pilha.pop()!;
    ids.push(atual);
    pilha.push(...(filhos.get(atual) ?? []));
  }
  return ids;
}

function compararLocais(a: LocalRow, b: LocalRow): number {
  if (a.tipo_sigla !== b.tipo_sigla) {
    return a.tipo_sigla < b.tipo_sigla ? -1 : 1;
  }
  // Sem número antes dos numerados.
  return (a.numero ?? 0) - (b.numero ?? 0);
}

/** Monta a árvore ordenada por tipo_sigla e depois numero, em todos os níveis. */
export function buildTree(rows: LocalRow[], tipos: TipoLocal[]): LocalNode[] {
  const nomesTipo = new Map(tipos.map((t) => [t.sigla, t.nome]));
  const nodes = new Map<string, LocalNode>();

  for (const row of rows) {
    nodes.set(row.id, {
      ...row,
      nome: nomeLocal(nomesTipo.get(row.tipo_sigla) ?? row.tipo_sigla, row.numero),
      depth: 0,
      children: [],
    });
  }

  const roots: LocalNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const ordenar = (lista: LocalNode[], depth: number) => {
    lista.sort(compararLocais);
    for (const n of lista) {
      n.depth = depth;
      ordenar(n.children, depth + 1);
    }
  };
  ordenar(roots, 0);

  return roots;
}
