"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListTodo, Search } from "lucide-react";
import { SemLocalTag } from "@/components/endereco-tag";
import { Combobox } from "@/components/itens/combobox";
import { FiltroSelecao, type OpcaoFiltro } from "@/components/itens/filtro-selecao";
import { opcoesCategoria, opcoesLocal } from "@/components/itens/opcoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ESTADOS,
  FREQUENCIAS,
  NATUREZAS,
  SEM_LOCAL,
  SITUACOES,
  type CategoriaRow,
  type Natureza,
} from "@/lib/itens";
import type { PessoaRow } from "@/lib/itens-data";
import { hrefItens, type Filtros } from "@/lib/itens-filtros";
import type { LocalRow } from "@/lib/locais";
import { cn } from "@/lib/utils";

const ESPERA_BUSCA_MS = 300;

function opcoesDominio(opcoes: readonly { value: string; label: string }[]): OpcaoFiltro[] {
  return opcoes.map(({ value, label }) => ({ value, label }));
}

const OPCOES_SITUACAO = opcoesDominio(SITUACOES);
const OPCOES_FREQUENCIA = opcoesDominio(FREQUENCIAS);
const OPCOES_ESTADO = opcoesDominio(ESTADOS);
const OPCOES_NATUREZA = opcoesDominio(NATUREZAS);

/** Busca, filtros e ordenação da lista de itens, todos guardados na URL. */
export function FiltrosItens({
  filtros,
  locais,
  categorias,
  pessoas,
  etiquetas,
}: {
  filtros: Filtros;
  locais: LocalRow[];
  categorias: CategoriaRow[];
  pessoas: PessoaRow[];
  etiquetas: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(filtros.q);
  // Último q que esta barra mandou para a URL. Um q diferente na URL veio de
  // fora (voltar/avançar, "Limpar filtros") e substitui o texto digitado.
  const [qUrl, setQUrl] = useState(filtros.q);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (filtros.q !== qUrl) {
    setQUrl(filtros.q);
    if (filtros.q !== q.trim()) setQ(filtros.q);
  }

  const opcoesLoc = useMemo(
    () => [
      { id: SEM_LOCAL, busca: ["Sem local"], conteudo: <SemLocalTag /> },
      ...opcoesLocal(locais),
    ],
    [locais],
  );
  const opcoesCat = useMemo(() => opcoesCategoria(categorias), [categorias]);
  const opcoesPessoa = useMemo(
    () => pessoas.map((p) => ({ value: p.id, label: p.nome })),
    [pessoas],
  );
  const opcoesEtiqueta = useMemo(
    () => etiquetas.map((e) => ({ value: e, label: e })),
    [etiquetas],
  );

  /** Filtros discretos entram no histórico; a busca digitada substitui a entrada. */
  function navegar(mudancas: Partial<Filtros>, substituir = false) {
    clearTimeout(espera.current);
    const href = hrefItens({ ...filtros, q, ...mudancas });
    if (substituir) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Buscar por nome, marca, modelo ou observações"
            placeholder="Buscar por nome, marca, modelo, observações"
            autoComplete="off"
            value={q}
            onChange={(e) => {
              const valor = e.target.value;
              setQ(valor);
              clearTimeout(espera.current);
              espera.current = setTimeout(() => {
                setQUrl(valor.trim());
                navegar({ q: valor }, true);
              }, ESPERA_BUSCA_MS);
            }}
            className="pl-8"
          />
        </div>
        <Combobox
          valor={filtros.local}
          opcoes={opcoesLoc}
          onChange={(local) => navegar({ local })}
          placeholder="Todos os locais"
          vazio="Nenhum local encontrado."
          limpavel
          className="w-64"
        />
        <Combobox
          valor={filtros.categoria}
          opcoes={opcoesCat}
          onChange={(categoria) => navegar({ categoria })}
          placeholder="Todas as categorias"
          vazio="Nenhuma categoria encontrada."
          limpavel
          className="w-56"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtros">
        <FiltroSelecao
          rotulo="Situação"
          opcoes={OPCOES_SITUACAO}
          selecionados={filtros.situacao}
          onChange={(v) => navegar({ situacao: v as Filtros["situacao"] })}
        />
        <FiltroSelecao
          rotulo="Frequência de uso"
          opcoes={OPCOES_FREQUENCIA}
          selecionados={filtros.frequencia}
          onChange={(v) => navegar({ frequencia: v as Filtros["frequencia"] })}
        />
        <FiltroSelecao
          rotulo="Estado"
          opcoes={OPCOES_ESTADO}
          selecionados={filtros.estado}
          onChange={(v) => navegar({ estado: v as Filtros["estado"] })}
        />
        <FiltroSelecao
          rotulo="Etiquetas"
          opcoes={opcoesEtiqueta}
          selecionados={filtros.etiquetas}
          onChange={(etiquetas) => navegar({ etiquetas })}
          vazio={etiquetas.length ? "Nenhuma etiqueta encontrada." : "Nenhuma etiqueta em uso."}
        />
        {pessoas.length > 0 && (
          <FiltroSelecao
            rotulo="Pessoa"
            multiplo={false}
            opcoes={opcoesPessoa}
            selecionados={filtros.pessoa ? [filtros.pessoa] : []}
            onChange={(v) => navegar({ pessoa: v[0] ?? null })}
            vazio="Nenhuma pessoa encontrada."
          />
        )}
        <FiltroSelecao
          rotulo="Natureza"
          multiplo={false}
          opcoes={OPCOES_NATUREZA}
          selecionados={filtros.natureza ? [filtros.natureza] : []}
          onChange={(v) => navegar({ natureza: (v[0] as Natureza | undefined) ?? null })}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={filtros.incompletos}
          title="Sem local, sem frequência de uso ou sem estado"
          onClick={() => navegar({ incompletos: !filtros.incompletos })}
          className={cn(
            "font-normal",
            filtros.incompletos && "border-primary/60 bg-primary/5 text-foreground",
          )}
        >
          <ListTodo aria-hidden />
          Incompletos
        </Button>
      </div>
    </div>
  );
}
