"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as PointerEventReact,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { EnderecoTag, SemLocalTag } from "@/components/endereco-tag";
import { BarraEmMassa } from "@/components/itens/barra-em-massa";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CategoriaRow } from "@/lib/itens";
import {
  COLUNAS_TABELA,
  LARGURAS_PADRAO,
  LARGURA_MINIMA,
  LARGURA_SELECAO,
  assinarLarguras,
  gravarLarguras,
  lerLarguras,
  snapshotLarguras,
  type ColunaTabela,
  type Larguras,
} from "@/lib/itens-colunas";
import type { PessoaRow } from "@/lib/itens-data";
import type { ColunaOrdem, Direcao } from "@/lib/itens-filtros";
import type { LocalRow } from "@/lib/locais";
import { cn } from "@/lib/utils";

export type LinhaItem = {
  id: string;
  nome: string;
  /** "Sub · Categoria" (tooltip e ordenação). */
  categoria: string;
  /** Nome da subcategoria, ou da categoria quando o item está no topo. */
  categoriaNome: string;
  endereco: string | null;
  quantidade: string;
  situacao: string;
  /** "há 2 dias" */
  cadastrado: string;
  /** Data e hora completas, para o title. */
  cadastradoEm: string;
  cadastradoIso: string;
  /** "há 2 dias" */
  atualizado: string;
  /** Data e hora completas, para o title. */
  atualizadoEm: string;
  atualizadoIso: string;
  etiquetas: string[];
};

export type Ordenacao = {
  ordem: ColunaOrdem;
  dir: Direcao;
  /** Href de cada cabeçalho (alterna a direção ou troca a coluna). */
  hrefs: Record<ColunaOrdem, string>;
};

function CabecalhoOrdenavel({
  coluna,
  ordenacao,
  className,
  alca,
  children,
}: {
  coluna: ColunaOrdem;
  ordenacao: Ordenacao;
  className?: string;
  /** Alça de redimensionar, na borda direita. */
  alca?: ReactNode;
  children: ReactNode;
}) {
  const ativo = ordenacao.ordem === coluna;
  const Seta = !ativo
    ? ArrowUpDown
    : ordenacao.dir === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <TableHead
      aria-sort={
        ativo
          ? ordenacao.dir === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
      className={cn("relative", className)}
    >
      <Link
        href={ordenacao.hrefs[coluna]}
        scroll={false}
        className={cn(
          "group inline-flex max-w-full items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          ativo ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {children}
        <Seta
          aria-hidden
          size={14}
          className={cn(
            !ativo &&
              "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60",
          )}
        />
      </Link>
      {alca}
    </TableHead>
  );
}

/**
 * Borda direita arrastável de um cabeçalho (4px). Duplo clique volta a coluna
 * ao padrão.
 */
function AlcaColuna({
  rotulo,
  onPointerDown,
  onDoubleClick,
}: {
  rotulo: string;
  onPointerDown: (event: PointerEventReact<HTMLSpanElement>) => void;
  onDoubleClick: () => void;
}) {
  return (
    <span
      aria-hidden
      title={`Arraste para ajustar a largura de ${rotulo}; duplo clique volta ao padrão`}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className="absolute top-0 -right-0.5 z-10 h-full w-1 cursor-col-resize touch-none select-none hover:bg-border"
    />
  );
}

/** Largura do tag mais longo: fonte mono de 13px (~7,85px por caractere). */
function minimoEndereco(linhas: { endereco: string | null }[]): number {
  const maior = Math.max(9, ...linhas.map((l) => (l.endereco ?? "").length));
  // + padding e borda do tag (18) + padding da célula (16).
  return Math.max(LARGURA_MINIMA, Math.ceil(maior * 7.85) + 34);
}

export function TabelaItens({
  linhas,
  ordenacao,
  voltar,
  locais,
  categorias,
  pessoas,
  etiquetas,
}: {
  linhas: LinhaItem[];
  ordenacao: Ordenacao;
  /** Query string atual da lista, levada ao item para voltar com os mesmos filtros. */
  voltar: string;
  locais: LocalRow[];
  categorias: CategoriaRow[];
  pessoas: PessoaRow[];
  etiquetas: string[];
}) {
  const router = useRouter();
  const sufixo = voltar ? `?voltar=${encodeURIComponent(voltar)}` : "";

  // Larguras das colunas: salvas no localStorage; durante o arraste, só no estado.
  const salvas = lerLarguras(
    useSyncExternalStore(assinarLarguras, snapshotLarguras, () => null),
  );
  const [arraste, setArraste] = useState<{ coluna: ColunaTabela; largura: number } | null>(
    null,
  );
  const minEndereco = useMemo(() => minimoEndereco(linhas), [linhas]);
  const minimo = (coluna: ColunaTabela) =>
    coluna === "endereco" ? minEndereco : LARGURA_MINIMA;
  const larguras = Object.fromEntries(
    COLUNAS_TABELA.map((c) => {
      const base =
        arraste?.coluna === c ? arraste.largura : (salvas[c] ?? LARGURAS_PADRAO[c]);
      return [c, Math.max(minimo(c), base)];
    }),
  ) as Larguras;
  const larguraTotal =
    LARGURA_SELECAO + COLUNAS_TABELA.reduce((soma, c) => soma + larguras[c], 0);

  function iniciarArraste(coluna: ColunaTabela, event: PointerEventReact<HTMLSpanElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const alca = event.currentTarget;
    alca.setPointerCapture(event.pointerId);
    const inicioX = event.clientX;
    const inicio = larguras[coluna];
    let atual = inicio;

    function mover(e: PointerEvent) {
      atual = Math.max(minimo(coluna), Math.round(inicio + e.clientX - inicioX));
      setArraste({ coluna, largura: atual });
    }
    function soltar() {
      alca.removeEventListener("pointermove", mover);
      alca.removeEventListener("pointerup", soltar);
      alca.removeEventListener("pointercancel", soltar);
      setArraste(null);
      if (atual !== inicio) gravarLarguras({ ...salvas, [coluna]: atual });
    }
    alca.addEventListener("pointermove", mover);
    alca.addEventListener("pointerup", soltar);
    alca.addEventListener("pointercancel", soltar);
  }

  function redefinirColuna(coluna: ColunaTabela) {
    const restantes = { ...salvas };
    delete restantes[coluna];
    gravarLarguras(restantes);
  }

  const alca = (coluna: ColunaTabela, rotulo: string) => (
    <AlcaColuna
      rotulo={rotulo}
      onPointerDown={(e) => iniciarArraste(coluna, e)}
      onDoubleClick={() => redefinirColuna(coluna)}
    />
  );

  // Seleção da edição em massa. A página troca a key deste componente quando
  // filtros ou ordenação mudam, o que zera a seleção.
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  /** Índice da última linha clicada, início do intervalo com Shift. */
  const ancora = useRef<number | null>(null);

  // Só conta o que está visível (a lista pode ter mudado depois de uma ação).
  const visiveis = useMemo(
    () => linhas.filter((l) => selecionados.has(l.id)),
    [linhas, selecionados],
  );
  const ids = useMemo(() => visiveis.map((l) => l.id), [visiveis]);
  const etiquetasDaSelecao = useMemo(
    () =>
      [...new Set(visiveis.flatMap((l) => l.etiquetas))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [visiveis],
  );
  const todos = linhas.length > 0 && ids.length === linhas.length;
  const algum = ids.length > 0 && !todos;

  function limpar() {
    setSelecionados(new Set());
    ancora.current = null;
  }

  function marcar(indice: number, marcado: boolean, intervalo: boolean) {
    const inicio =
      intervalo && ancora.current !== null ? ancora.current : indice;
    const [de, ate] = inicio <= indice ? [inicio, indice] : [indice, inicio];
    const alvo = linhas.slice(de, ate + 1).map((l) => l.id);
    setSelecionados((atual) => {
      const novo = new Set(atual);
      for (const id of alvo) {
        if (marcado) novo.add(id);
        else novo.delete(id);
      }
      return novo;
    });
    ancora.current = indice;
  }

  // Esc limpa a seleção, exceto quando fecha um popover/diálogo ou está num campo.
  useEffect(() => {
    if (ids.length === 0) return;
    function aoTeclar(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const alvo = event.target instanceof Element ? event.target : null;
      if (
        alvo?.closest(
          "input, textarea, select, [contenteditable], [role=dialog], [role=alertdialog], [data-slot=popover-content]",
        )
      ) {
        return;
      }
      setSelecionados(new Set());
      ancora.current = null;
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [ids.length]);

  return (
    <>
      {/* table-fixed: as larguras em px valem e o texto longo é cortado. A última
        coluna, vazia e sem largura, ocupa o que sobra do container; a tabela só
        rola na horizontal se as larguras somadas passarem dele. */}
      <Table className="table-fixed" style={{ minWidth: larguraTotal }}>
        <colgroup>
          <col style={{ width: LARGURA_SELECAO }} />
          {COLUNAS_TABELA.map((c) => (
            <col key={c} style={{ width: larguras[c] }} />
          ))}
          <col />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>
              <Checkbox
                aria-label={
                  todos
                    ? "Desmarcar todos"
                    : "Selecionar todos os itens visíveis"
                }
                checked={todos}
                indeterminate={algum}
                onCheckedChange={(marcado) => {
                  setSelecionados(
                    marcado ? new Set(linhas.map((l) => l.id)) : new Set(),
                  );
                  ancora.current = null;
                }}
              />
            </TableHead>
            <CabecalhoOrdenavel
              coluna="nome"
              ordenacao={ordenacao}
              alca={alca("nome", "Nome")}
            >
              Nome
            </CabecalhoOrdenavel>
            <CabecalhoOrdenavel
              coluna="categoria"
              ordenacao={ordenacao}
              alca={alca("categoria", "Categoria")}
            >
              Categoria
            </CabecalhoOrdenavel>
            <CabecalhoOrdenavel
              coluna="endereco"
              ordenacao={ordenacao}
              alca={alca("endereco", "Endereço")}
            >
              Endereço
            </CabecalhoOrdenavel>
            <CabecalhoOrdenavel
              coluna="qtd"
              ordenacao={ordenacao}
              className="text-right"
              alca={alca("qtd", "Qtd")}
            >
              Qtd
            </CabecalhoOrdenavel>
            <TableHead className="relative">
              Situação
              {alca("situacao", "Situação")}
            </TableHead>
            <CabecalhoOrdenavel
              coluna="cadastrado"
              ordenacao={ordenacao}
              alca={alca("cadastrado", "Cadastrado")}
            >
              Cadastrado
            </CabecalhoOrdenavel>
            <CabecalhoOrdenavel
              coluna="atualizado"
              ordenacao={ordenacao}
              alca={alca("atualizado", "Atualizado")}
            >
              Atualizado
            </CabecalhoOrdenavel>
            <TableHead aria-hidden className="p-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((l, indice) => (
            <TableRow
              key={l.id}
              data-state={selecionados.has(l.id) ? "selected" : undefined}
              onClick={() => router.push(`/itens/${l.id}${sufixo}`)}
              className="cursor-pointer hover:bg-surface-hover focus-within:bg-surface-hover"
            >
              {/* A célula inteira é área de clique da caixa e não abre o item. */}
              <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  aria-label={`Selecionar ${l.nome}`}
                  checked={selecionados.has(l.id)}
                  onCheckedChange={(marcado, detalhes) => {
                    const evento = detalhes.event as
                      MouseEvent | KeyboardEvent | undefined;
                    marcar(indice, marcado, Boolean(evento?.shiftKey));
                  }}
                />
              </TableCell>
              <TableCell className="truncate py-1" title={l.nome}>
                {/* O link dá acesso por teclado; o clique na linha inteira também abre. */}
                <Link
                  href={`/itens/${l.id}${sufixo}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {l.nome}
                </Link>
              </TableCell>
              <TableCell
                className="truncate py-1 text-muted-foreground"
                title={l.categoria}
              >
                {l.categoriaNome}
              </TableCell>
              <TableCell className="py-1">
                {l.endereco === null ? (
                  <SemLocalTag />
                ) : (
                  <EnderecoTag
                    endereco={l.endereco}
                    className="max-w-full truncate align-middle"
                  />
                )}
              </TableCell>
              <TableCell
                className="truncate py-1 text-right tabular-nums"
                title={l.quantidade}
              >
                {l.quantidade}
              </TableCell>
              <TableCell
                className="truncate py-1 text-muted-foreground"
                title={l.situacao}
              >
                {l.situacao}
              </TableCell>
              <TableCell className="truncate py-1 text-muted-foreground">
                <time dateTime={l.cadastradoIso} title={l.cadastradoEm}>
                  {l.cadastrado}
                </time>
              </TableCell>
              <TableCell className="truncate py-1 text-muted-foreground">
                <time dateTime={l.atualizadoIso} title={l.atualizadoEm}>
                  {l.atualizado}
                </time>
              </TableCell>
              <TableCell aria-hidden className="p-0" />
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {ids.length > 0 && (
        <BarraEmMassa
          ids={ids}
          etiquetasDaSelecao={etiquetasDaSelecao}
          locais={locais}
          categorias={categorias}
          pessoas={pessoas}
          etiquetas={etiquetas}
          onLimpar={limpar}
        />
      )}
    </>
  );
}
