"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  children,
}: {
  coluna: ColunaOrdem;
  ordenacao: Ordenacao;
  className?: string;
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
      className={className}
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
    </TableHead>
  );
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
      {/* table-fixed: as larguras abaixo valem e o texto longo é cortado. 976px é a
        largura útil do conteúdo a 1280px de tela; abaixo disso a tabela rola. */}
      <Table className="min-w-[976px] table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">
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
              className="w-[26%]"
            >
              Nome
            </CabecalhoOrdenavel>
            <CabecalhoOrdenavel
              coluna="categoria"
              ordenacao={ordenacao}
              className="w-[20%]"
            >
              Categoria
            </CabecalhoOrdenavel>
            <CabecalhoOrdenavel coluna="endereco" ordenacao={ordenacao}>
              Endereço
            </CabecalhoOrdenavel>
            <CabecalhoOrdenavel
              coluna="qtd"
              ordenacao={ordenacao}
              className="w-[6%] text-right"
            >
              Qtd
            </CabecalhoOrdenavel>
            <TableHead className="w-[10%]">Situação</TableHead>
            <CabecalhoOrdenavel
              coluna="cadastrado"
              ordenacao={ordenacao}
              className="w-[11%]"
            >
              Cadastrado
            </CabecalhoOrdenavel>
            <CabecalhoOrdenavel
              coluna="atualizado"
              ordenacao={ordenacao}
              className="w-[11%]"
            >
              Atualizado
            </CabecalhoOrdenavel>
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
