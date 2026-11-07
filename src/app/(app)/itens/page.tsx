import { Suspense } from "react";
import Link from "next/link";
import { io } from "next/cache";
import { Plus, X } from "lucide-react";
import { FiltrosItens } from "@/components/itens/filtros-itens";
import { TabelaItens, type LinhaItem } from "@/components/itens/tabela-itens";
import { buttonVariants } from "@/components/ui/button";
import {
  carregarCategorias,
  carregarEtiquetas,
  carregarPessoas,
  contarItensSemLocal,
  listarItens,
  type ItemResumo,
} from "@/lib/itens-data";
import {
  SEM_LOCAL,
  SITUACOES,
  corresponde,
  formatQuantidade,
  idsCategoriaComSubs,
  rotulo,
  rotuloCategoria,
} from "@/lib/itens";
import {
  COLUNAS_ORDEM,
  FILTROS_VAZIOS,
  formatDataHora,
  hrefItens,
  hrefOrdenacao,
  lerFiltros,
  semFiltros,
  temFiltroAtivo,
  tempoRelativo,
  type ColunaOrdem,
  type Filtros,
} from "@/lib/itens-filtros";
import { carregarLocais } from "@/lib/locais-data";
import { idsComDescendentes } from "@/lib/locais";
import { createClient } from "@/lib/supabase/server";

/** Link que aplica o filtro "Sem local", mantendo a busca e a categoria. */
async function LinkSemLocal({
  searchParams,
}: {
  searchParams: PageProps<"/itens">["searchParams"];
}) {
  const filtros = lerFiltros(await searchParams);
  const total = await contarItensSemLocal(await createClient());
  if (total === 0) return null;

  return (
    <Link
      href={hrefItens({
        ...FILTROS_VAZIOS,
        q: filtros.q,
        categoria: filtros.categoria,
        local: SEM_LOCAL,
      })}
      className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {total} {total === 1 ? "item" : "itens"} sem local
    </Link>
  );
}

type LinhaOrdenavel = { item: ItemResumo; linha: LinhaItem };

/** Instante da requisição, fora do shell estático. */
async function agoraNaRequisicao(): Promise<number> {
  await io();
  return Date.now();
}

const textoBR = (a: string, b: string) => a.localeCompare(b, "pt-BR");

function comparar(coluna: ColunaOrdem, a: LinhaOrdenavel, b: LinhaOrdenavel): number {
  switch (coluna) {
    case "nome":
      return textoBR(a.linha.nome, b.linha.nome);
    case "categoria":
      return textoBR(a.linha.categoria, b.linha.categoria);
    case "endereco":
      // Sem local ("") vem primeiro na ordem crescente.
      return textoBR(a.linha.endereco ?? "", b.linha.endereco ?? "");
    case "qtd":
      return a.item.quantidade - b.item.quantidade || textoBR(a.item.unidade, b.item.unidade);
    case "cadastrado":
      return Date.parse(a.item.created_at) - Date.parse(b.item.created_at);
    case "atualizado":
      return Date.parse(a.item.updated_at) - Date.parse(b.item.updated_at);
  }
}

async function Lista({ searchParams }: { searchParams: PageProps<"/itens">["searchParams"] }) {
  const pedidos = lerFiltros(await searchParams);
  const supabase = await createClient();
  const [{ locais }, categorias, pessoas, etiquetas] = await Promise.all([
    carregarLocais(supabase),
    carregarCategorias(supabase),
    carregarPessoas(supabase),
    carregarEtiquetas(supabase),
  ]);

  // Ids que não existem (mais) são ignorados.
  const local = locais.find((l) => l.id === pedidos.local);
  const categoria = categorias.find((c) => c.id === pedidos.categoria);
  const filtros: Filtros = {
    ...pedidos,
    local: pedidos.local === SEM_LOCAL ? SEM_LOCAL : (local?.id ?? null),
    categoria: categoria?.id ?? null,
    pessoa: pessoas.some((p) => p.id === pedidos.pessoa) ? pedidos.pessoa : null,
  };

  const itens = await listarItens(supabase, {
    localIds: local ? idsComDescendentes(local.id, locais) : null,
    semLocal: filtros.local === SEM_LOCAL,
    categoriaIds: categoria ? idsCategoriaComSubs(categoria.id, categorias) : null,
    situacoes: filtros.situacao,
    frequencias: filtros.frequencia,
    estados: filtros.estado,
    etiquetas: filtros.etiquetas,
    pessoaId: filtros.pessoa,
    natureza: filtros.natureza,
    incompletos: filtros.incompletos,
  });

  // Busca sem distinção de acentos e maiúsculas: o banco não tem a extensão
  // unaccent, então o texto é filtrado aqui, depois da consulta.
  const filtrados = filtros.q
    ? itens.filter((i) =>
        corresponde(filtros.q, i.nome, i.marca ?? "", i.modelo ?? "", i.observacoes ?? ""),
      )
    : itens;

  const agora = await agoraNaRequisicao();

  const locaisPorId = new Map(locais.map((l) => [l.id, l]));
  const categoriasPorId = new Map(categorias.map((c) => [c.id, c]));
  const sinal = filtros.dir === "asc" ? 1 : -1;
  const linhas: LinhaItem[] = filtrados
    .map((i): LinhaOrdenavel => {
      const cat = categoriasPorId.get(i.categoria_id);
      const linha: LinhaItem = {
        id: i.id,
        nome: i.nome,
        categoria: cat ? rotuloCategoria(cat, categoriasPorId) : "",
        endereco: i.local_id ? (locaisPorId.get(i.local_id)?.endereco ?? null) : null,
        quantidade: formatQuantidade(i.quantidade, i.unidade),
        situacao: rotulo(SITUACOES, i.situacao),
        cadastrado: tempoRelativo(i.created_at, agora),
        cadastradoEm: formatDataHora(i.created_at),
        cadastradoIso: i.created_at,
        atualizado: tempoRelativo(i.updated_at, agora),
        atualizadoEm: formatDataHora(i.updated_at),
        atualizadoIso: i.updated_at,
      };
      return { item: i, linha };
    })
    .sort(
      (a, b) =>
        sinal * comparar(filtros.ordem, a, b) ||
        textoBR(a.linha.nome, b.linha.nome) ||
        textoBR(a.item.id, b.item.id),
    )
    .map(({ linha }) => linha);

  const temFiltro = temFiltroAtivo(filtros);
  const hrefs = Object.fromEntries(
    COLUNAS_ORDEM.map((c) => [c, hrefOrdenacao(filtros, c)]),
  ) as Record<ColunaOrdem, string>;

  return (
    <div className="mt-6 flex flex-col gap-4">
      <FiltrosItens
        filtros={filtros}
        locais={locais}
        categorias={categorias}
        pessoas={pessoas}
        etiquetas={etiquetas}
      />
      {(linhas.length > 0 || temFiltro) && (
        <div className="flex min-h-7 items-center gap-3 text-sm">
          <p className="text-muted-foreground" aria-live="polite">
            {linhas.length} {linhas.length === 1 ? "item" : "itens"}
          </p>
          {temFiltro && (
            <Link
              href={hrefItens(semFiltros(filtros))}
              scroll={false}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <X aria-hidden />
              Limpar filtros
            </Link>
          )}
        </div>
      )}
      {linhas.length === 0 ? (
        <p className="text-muted-foreground">
          {temFiltro ? "Nenhum item corresponde aos filtros." : "Nenhum item cadastrado."}
        </p>
      ) : (
        <TabelaItens
          linhas={linhas}
          ordenacao={{ ordem: filtros.ordem, dir: filtros.dir, hrefs }}
        />
      )}
    </div>
  );
}

export default function ItensPage({ searchParams }: PageProps<"/itens">) {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-semibold">Itens</h1>
          <Suspense fallback={null}>
            <LinkSemLocal searchParams={searchParams} />
          </Suspense>
        </div>
        <Link href="/itens/novo" className={buttonVariants()}>
          <Plus aria-hidden />
          Novo item
        </Link>
      </div>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">Carregando…</p>}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </>
  );
}
