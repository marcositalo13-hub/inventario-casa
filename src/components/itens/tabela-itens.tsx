"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { EnderecoTag, SemLocalTag } from "@/components/endereco-tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ColunaOrdem, Direcao } from "@/lib/itens-filtros";
import { cn } from "@/lib/utils";

export type LinhaItem = {
  id: string;
  nome: string;
  categoria: string;
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
  const Seta = !ativo ? ArrowUpDown : ordenacao.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      aria-sort={ativo ? (ordenacao.dir === "asc" ? "ascending" : "descending") : undefined}
      className={className}
    >
      <Link
        href={ordenacao.hrefs[coluna]}
        scroll={false}
        className={cn(
          "group inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          ativo ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {children}
        <Seta
          aria-hidden
          size={14}
          className={cn(!ativo && "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60")}
        />
      </Link>
    </TableHead>
  );
}

export function TabelaItens({
  linhas,
  ordenacao,
}: {
  linhas: LinhaItem[];
  ordenacao: Ordenacao;
}) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <CabecalhoOrdenavel coluna="nome" ordenacao={ordenacao}>
            Nome
          </CabecalhoOrdenavel>
          <CabecalhoOrdenavel coluna="categoria" ordenacao={ordenacao}>
            Categoria
          </CabecalhoOrdenavel>
          <CabecalhoOrdenavel coluna="endereco" ordenacao={ordenacao}>
            Endereço
          </CabecalhoOrdenavel>
          <CabecalhoOrdenavel coluna="qtd" ordenacao={ordenacao} className="text-right">
            Qtd
          </CabecalhoOrdenavel>
          <TableHead>Situação</TableHead>
          <CabecalhoOrdenavel coluna="cadastrado" ordenacao={ordenacao}>
            Cadastrado
          </CabecalhoOrdenavel>
          <CabecalhoOrdenavel coluna="atualizado" ordenacao={ordenacao}>
            Atualizado
          </CabecalhoOrdenavel>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((l) => (
          <TableRow
            key={l.id}
            onClick={() => router.push(`/itens/${l.id}`)}
            className="cursor-pointer hover:bg-surface-hover focus-within:bg-surface-hover"
          >
            <TableCell className="max-w-64 truncate py-1">
              {/* O link dá acesso por teclado; o clique na linha inteira também abre. */}
              <Link
                href={`/itens/${l.id}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {l.nome}
              </Link>
            </TableCell>
            <TableCell className="max-w-56 truncate py-1 text-muted-foreground">
              {l.categoria}
            </TableCell>
            <TableCell className="py-1">
              {l.endereco === null ? <SemLocalTag /> : <EnderecoTag endereco={l.endereco} />}
            </TableCell>
            <TableCell className="py-1 text-right tabular-nums">{l.quantidade}</TableCell>
            <TableCell className="py-1 text-muted-foreground">{l.situacao}</TableCell>
            <TableCell className="py-1 whitespace-nowrap text-muted-foreground">
              <time dateTime={l.cadastradoIso} title={l.cadastradoEm}>
                {l.cadastrado}
              </time>
            </TableCell>
            <TableCell className="py-1 whitespace-nowrap text-muted-foreground">
              <time dateTime={l.atualizadoIso} title={l.atualizadoEm}>{l.atualizado}</time>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
