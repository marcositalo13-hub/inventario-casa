"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { corresponde } from "@/lib/itens";
import { cn } from "@/lib/utils";

export type OpcaoFiltro = { value: string; label: string };

/**
 * Filtro compacto em Popover + Command. Múltiplo: alterna cada opção e mostra a
 * contagem no botão. Único: escolhe uma opção (clicar de novo desmarca) e mostra
 * o rótulo escolhido.
 */
export function FiltroSelecao({
  rotulo,
  opcoes,
  selecionados,
  onChange,
  multiplo = true,
  vazio = "Nada encontrado.",
}: {
  rotulo: string;
  opcoes: OpcaoFiltro[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  multiplo?: boolean;
  vazio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  const qtd = selecionados.length;
  const escolhido = !multiplo && qtd ? opcoes.find((o) => o.value === selecionados[0]) : null;

  function alternar(valor: string) {
    if (multiplo) {
      onChange(
        selecionados.includes(valor)
          ? selecionados.filter((v) => v !== valor)
          : // Mantém a ordem das opções.
            opcoes.map((o) => o.value).filter((v) => v === valor || selecionados.includes(v)),
      );
    } else {
      onChange(selecionados[0] === valor ? [] : [valor]);
      setAberto(false);
    }
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={aberto}
            className={cn("font-normal", qtd > 0 && "border-primary/60 bg-primary/5")}
          />
        }
      >
        {rotulo}
        {multiplo && qtd > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-xs leading-4 font-medium tabular-nums text-primary-foreground">
            <span className="sr-only">: </span>
            {qtd}
            <span className="sr-only"> {qtd === 1 ? "selecionado" : "selecionados"}</span>
          </span>
        )}
        {escolhido && (
          <span className="max-w-32 truncate text-muted-foreground">: {escolhido.label}</span>
        )}
        <ChevronDown aria-hidden className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" initialFocus={buscaRef} className="w-60 p-0">
        <Command
          filter={(_valor, busca, palavras) => (corresponde(busca, ...(palavras ?? [])) ? 1 : 0)}
        >
          <CommandInput ref={buscaRef} placeholder="Buscar…" />
          <CommandList>
            <CommandEmpty>{vazio}</CommandEmpty>
            {opcoes.map((o, i) => (
              <CommandItem
                // O índice evita colisão entre valores que diferem só em maiúsculas.
                key={o.value}
                value={String(i)}
                keywords={[o.label]}
                data-checked={selecionados.includes(o.value)}
                onSelect={() => alternar(o.value)}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
              </CommandItem>
            ))}
          </CommandList>
          {multiplo && qtd > 0 && (
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => onChange([])}
              >
                Limpar seleção
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
