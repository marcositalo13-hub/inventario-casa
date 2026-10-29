"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EnderecoTag } from "@/components/endereco-tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type LinhaItem = {
  id: string;
  nome: string;
  categoria: string;
  endereco: string;
  quantidade: string;
  situacao: string;
};

export function TabelaItens({ linhas }: { linhas: LinhaItem[] }) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Nome</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Endereço</TableHead>
          <TableHead className="text-right">Qtd</TableHead>
          <TableHead>Situação</TableHead>
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
              <EnderecoTag endereco={l.endereco} />
            </TableCell>
            <TableCell className="py-1 text-right tabular-nums">{l.quantidade}</TableCell>
            <TableCell className="py-1 text-muted-foreground">{l.situacao}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
