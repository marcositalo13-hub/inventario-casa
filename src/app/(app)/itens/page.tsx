import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FiltrosItens, type Filtros } from "@/components/itens/filtros-itens";
import { TabelaItens, type LinhaItem } from "@/components/itens/tabela-itens";
import { buttonVariants } from "@/components/ui/button";
import { carregarCategorias, contarItensSemLocal, listarItens } from "@/lib/itens-data";
import {
  SEM_LOCAL,
  SITUACOES,
  corresponde,
  formatQuantidade,
  idsCategoriaComSubs,
  rotulo,
  rotuloCategoria,
} from "@/lib/itens";
import { carregarLocais } from "@/lib/locais-data";
import { idsComDescendentes } from "@/lib/locais";
import { createClient } from "@/lib/supabase/server";

function primeiro(valor: string | string[] | undefined): string | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && v.trim() ? v.trim() : null;
}

/** Link que aplica o filtro "Sem local", mantendo a busca e a categoria. */
async function LinkSemLocal({
  searchParams,
}: {
  searchParams: PageProps<"/itens">["searchParams"];
}) {
  const params = await searchParams;
  const total = await contarItensSemLocal(await createClient());
  if (total === 0) return null;

  const busca = new URLSearchParams({ local: SEM_LOCAL });
  const q = primeiro(params.q);
  const categoria = primeiro(params.categoria);
  if (q) busca.set("q", q);
  if (categoria) busca.set("categoria", categoria);

  return (
    <Link
      href={`/itens?${busca}`}
      className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {total} {total === 1 ? "item" : "itens"} sem local
    </Link>
  );
}

async function Lista({ searchParams }: { searchParams: PageProps<"/itens">["searchParams"] }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ locais }, categorias] = await Promise.all([
    carregarLocais(supabase),
    carregarCategorias(supabase),
  ]);

  const semLocal = primeiro(params.local) === SEM_LOCAL;
  const local = locais.find((l) => l.id === primeiro(params.local));
  const categoria = categorias.find((c) => c.id === primeiro(params.categoria));
  const filtros: Filtros = {
    q: primeiro(params.q) ?? "",
    local: semLocal ? SEM_LOCAL : (local?.id ?? null),
    categoria: categoria?.id ?? null,
  };

  const itens = await listarItens(supabase, {
    localIds: local ? idsComDescendentes(local.id, locais) : null,
    semLocal,
    categoriaIds: categoria ? idsCategoriaComSubs(categoria.id, categorias) : null,
  });

  // Busca sem distinção de acentos e maiúsculas: o banco não tem a extensão
  // unaccent, então o filtro por nome é aplicado aqui.
  const filtrados = filtros.q ? itens.filter((i) => corresponde(filtros.q, i.nome)) : itens;

  const locaisPorId = new Map(locais.map((l) => [l.id, l]));
  const categoriasPorId = new Map(categorias.map((c) => [c.id, c]));
  const linhas: LinhaItem[] = filtrados
    .map((i) => {
      const cat = categoriasPorId.get(i.categoria_id);
      return {
        id: i.id,
        nome: i.nome,
        categoria: cat ? rotuloCategoria(cat, categoriasPorId) : "",
        endereco: i.local_id ? (locaisPorId.get(i.local_id)?.endereco ?? null) : null,
        quantidade: formatQuantidade(i.quantidade, i.unidade),
        situacao: rotulo(SITUACOES, i.situacao),
      };
    })
    .sort(
      (a, b) =>
        // Sem local ("") vem primeiro.
        (a.endereco ?? "").localeCompare(b.endereco ?? "", "pt-BR") ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );

  const temFiltro = Boolean(filtros.q || filtros.local || filtros.categoria);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <FiltrosItens filtros={filtros} locais={locais} categorias={categorias} />
      {linhas.length === 0 ? (
        <p className="text-muted-foreground">
          {temFiltro ? "Nenhum item encontrado com esses filtros." : "Nenhum item cadastrado."}
        </p>
      ) : (
        <>
          <TabelaItens linhas={linhas} />
          <p className="text-sm text-muted-foreground">
            {linhas.length} {linhas.length === 1 ? "item" : "itens"}
          </p>
        </>
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
