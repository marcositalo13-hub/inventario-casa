"use client";

import { useRef, useState, type ReactNode, type Ref } from "react";
import { ChevronsUpDown, X } from "lucide-react";
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

export type OpcaoCombobox = {
  id: string;
  /** Textos usados na busca (sem distinção de acentos e maiúsculas). */
  busca: string[];
  conteudo: ReactNode;
};

/** Seleção única com busca, em Popover + Command. */
export function Combobox({
  id,
  valor,
  opcoes,
  onChange,
  placeholder,
  vazio = "Nada encontrado.",
  invalido,
  limpavel,
  triggerRef,
  className,
}: {
  id?: string;
  valor: string | null;
  opcoes: OpcaoCombobox[];
  onChange: (valor: string | null) => void;
  placeholder: string;
  vazio?: string;
  invalido?: boolean;
  limpavel?: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  const atual = opcoes.find((o) => o.id === valor);

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger
          render={
            <Button
              ref={triggerRef}
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={aberto}
              aria-invalid={invalido || undefined}
              className="h-auto min-h-8 w-full min-w-0 justify-between gap-2 py-1 font-normal"
            />
          }
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
            {atual ? (
              atual.conteudo
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown aria-hidden className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          initialFocus={buscaRef}
          className="w-(--anchor-width) min-w-80 p-0"
        >
          <Command
            filter={(_valor, busca, palavras) =>
              corresponde(busca, ...(palavras ?? [])) ? 1 : 0
            }
          >
            <CommandInput ref={buscaRef} placeholder="Buscar…" />
            <CommandList>
              <CommandEmpty>{vazio}</CommandEmpty>
              {opcoes.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  keywords={o.busca}
                  data-checked={o.id === valor}
                  onSelect={() => {
                    onChange(o.id);
                    setAberto(false);
                  }}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {o.conteudo}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {limpavel && valor && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Limpar"
          onClick={() => onChange(null)}
          className="text-muted-foreground"
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
