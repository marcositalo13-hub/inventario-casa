"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Combobox } from "@/components/itens/combobox";
import { opcoesCategoria, opcoesLocal } from "@/components/itens/opcoes";
import { Input } from "@/components/ui/input";
import type { CategoriaRow } from "@/lib/itens";
import type { LocalRow } from "@/lib/locais";

export type Filtros = { q: string; local: string | null; categoria: string | null };

/** Filtros da lista de itens, guardados na URL (?q=&local=&categoria=). */
export function FiltrosItens({
  filtros,
  locais,
  categorias,
}: {
  filtros: Filtros;
  locais: LocalRow[];
  categorias: CategoriaRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filtros.q);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  const opcoesLoc = useMemo(() => opcoesLocal(locais), [locais]);
  const opcoesCat = useMemo(() => opcoesCategoria(categorias), [categorias]);

  function aplicar(novos: Filtros) {
    const params = new URLSearchParams();
    if (novos.q.trim()) params.set("q", novos.q.trim());
    if (novos.local) params.set("local", novos.local);
    if (novos.categoria) params.set("categoria", novos.categoria);
    const busca = params.toString();
    router.replace(busca ? `${pathname}?${busca}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Buscar por nome"
          placeholder="Buscar por nome"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            const valor = e.target.value;
            setQ(valor);
            clearTimeout(espera.current);
            espera.current = setTimeout(() => aplicar({ ...filtros, q: valor }), 250);
          }}
          className="pl-8"
        />
      </div>
      <Combobox
        valor={filtros.local}
        opcoes={opcoesLoc}
        onChange={(local) => aplicar({ ...filtros, q, local })}
        placeholder="Todos os locais"
        vazio="Nenhum local encontrado."
        limpavel
        className="w-64"
      />
      <Combobox
        valor={filtros.categoria}
        opcoes={opcoesCat}
        onChange={(categoria) => aplicar({ ...filtros, q, categoria })}
        placeholder="Todas as categorias"
        vazio="Nenhuma categoria encontrada."
        limpavel
        className="w-56"
      />
    </div>
  );
}
