// Larguras das colunas da lista de itens, em pixels, guardadas no localStorage.
// Leitura e escrita protegidas: sem armazenamento, valem os padrões.

export const COLUNAS_TABELA = [
  "nome",
  "categoria",
  "endereco",
  "qtd",
  "situacao",
  "cadastrado",
  "atualizado",
] as const;
export type ColunaTabela = (typeof COLUNAS_TABELA)[number];
export type Larguras = Record<ColunaTabela, number>;

/** Somam 930px + 40px da caixa de seleção: cabem a 1280px de tela. */
export const LARGURAS_PADRAO: Larguras = {
  nome: 240,
  categoria: 185,
  endereco: 150,
  qtd: 60,
  situacao: 95,
  cadastrado: 100,
  atualizado: 100,
};

export const LARGURA_MINIMA = 60;
export const LARGURA_SELECAO = 40;

const CHAVE = "itens-colunas";
const EVENTO = "itens-colunas";

// Cache da string lida: o snapshot precisa ser estável entre renders.
let cache: string | null | undefined;

function ler(): string | null {
  if (cache !== undefined) return cache;
  try {
    cache = window.localStorage.getItem(CHAVE);
  } catch {
    cache = null;
  }
  return cache;
}

export function assinarLarguras(aviso: () => void) {
  window.addEventListener(EVENTO, aviso);
  return () => window.removeEventListener(EVENTO, aviso);
}

export function snapshotLarguras(): string | null {
  return ler();
}

/** Larguras salvas que forem números válidos; o resto fica no padrão. */
export function lerLarguras(bruto: string | null): Partial<Larguras> {
  if (!bruto) return {};
  try {
    const dados: unknown = JSON.parse(bruto);
    if (!dados || typeof dados !== "object") return {};
    const resultado: Partial<Larguras> = {};
    for (const coluna of COLUNAS_TABELA) {
      const v = (dados as Record<string, unknown>)[coluna];
      if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 5000) {
        resultado[coluna] = Math.round(v);
      }
    }
    return resultado;
  } catch {
    return {};
  }
}

export function gravarLarguras(larguras: Partial<Larguras>) {
  const texto = JSON.stringify(larguras);
  cache = texto;
  try {
    window.localStorage.setItem(CHAVE, texto);
  } catch {
    // Sem armazenamento: vale só até recarregar a página.
  }
  window.dispatchEvent(new Event(EVENTO));
}
