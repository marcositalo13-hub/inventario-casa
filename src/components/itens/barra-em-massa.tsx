"use client";

import {
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  adicionarEtiquetaItens,
  alterarCategoriaItens,
  alterarEstadoItens,
  alterarFrequenciaItens,
  alterarSituacaoItens,
  atribuirPessoaItens,
  moverItens,
  previaAlterarCategoria,
  removerEtiquetaItens,
  type ResultadoMassa,
} from "@/app/(app)/itens/actions";
import { SemLocalTag } from "@/components/endereco-tag";
import { Combobox } from "@/components/itens/combobox";
import { opcoesCategoria, opcoesLocal } from "@/components/itens/opcoes";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ESTADOS,
  FREQUENCIAS,
  LIMITE_EM_MASSA,
  SEM_LOCAL,
  SITUACOES,
  corresponde,
  rotuloCategoria,
  type CategoriaRow,
} from "@/lib/itens";
import type { PessoaRow } from "@/lib/itens-data";
import type { LocalRow } from "@/lib/locais";

type Opcao = { value: string; label: string };

const filtroBusca = (_valor: string, busca: string, palavras?: string[]) =>
  corresponde(busca, ...(palavras ?? [])) ? 1 : 0;

function itens(n: number) {
  return `${n} ${n === 1 ? "item" : "itens"}`;
}

/** Botão do tipo "Ação ▾" que abre um popover. */
function Gatilho({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled: boolean;
}) {
  return (
    <PopoverTrigger
      disabled={disabled}
      render={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-normal"
        />
      }
    >
      {children}
      <ChevronDown aria-hidden className="text-muted-foreground" />
    </PopoverTrigger>
  );
}

/** Lista de opções num popover; escolher fecha e executa. */
function MenuAcao({
  rotulo,
  opcoes,
  onEscolher,
  disabled,
  vazio = "Nada encontrado.",
}: {
  rotulo: string;
  opcoes: Opcao[];
  onEscolher: (valor: string) => void;
  disabled: boolean;
  vazio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <Gatilho disabled={disabled}>{rotulo}</Gatilho>
      <PopoverContent
        side="top"
        align="start"
        initialFocus={buscaRef}
        className="w-60 p-0"
      >
        <Command filter={filtroBusca}>
          <CommandInput ref={buscaRef} placeholder="Buscar…" />
          <CommandList>
            <CommandEmpty>{vazio}</CommandEmpty>
            {opcoes.map((o, i) => (
              <CommandItem
                key={o.value}
                value={String(i)}
                keywords={[o.label]}
                onSelect={() => {
                  setAberto(false);
                  onEscolher(o.value);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Situação; "emprestado" pede "Emprestado para" no mesmo popover. */
function MenuSituacao({
  onAplicar,
  disabled,
}: {
  onAplicar: (situacao: string, emprestadoPara: string | null) => void;
  disabled: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [emprestando, setEmprestando] = useState(false);
  const [destino, setDestino] = useState("");
  const buscaRef = useRef<HTMLInputElement>(null);
  const destinoRef = useRef<HTMLInputElement>(null);

  function abrir(a: boolean) {
    setAberto(a);
    if (!a) {
      setEmprestando(false);
      setDestino("");
    }
  }

  function confirmar(event: FormEvent) {
    event.preventDefault();
    if (!destino.trim()) {
      destinoRef.current?.focus();
      return;
    }
    abrir(false);
    onAplicar("emprestado", destino.trim());
  }

  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <Gatilho disabled={disabled}>Situação</Gatilho>
      <PopoverContent
        side="top"
        align="start"
        initialFocus={emprestando ? destinoRef : buscaRef}
        className="w-64 p-0"
      >
        {emprestando ? (
          <form onSubmit={confirmar} className="flex flex-col gap-2 p-3">
            <Label htmlFor="massa-emprestado-para">Emprestado para</Label>
            <Input
              id="massa-emprestado-para"
              ref={destinoRef}
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              autoComplete="off"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEmprestando(false)}
              >
                Voltar
              </Button>
              <Button type="submit" size="sm" disabled={!destino.trim()}>
                Aplicar
              </Button>
            </div>
          </form>
        ) : (
          <Command filter={filtroBusca}>
            <CommandInput ref={buscaRef} placeholder="Buscar…" />
            <CommandList>
              <CommandEmpty>Nada encontrado.</CommandEmpty>
              {SITUACOES.map((s) => (
                <CommandItem
                  key={s.value}
                  value={s.value}
                  keywords={[s.label]}
                  onSelect={() => {
                    if (s.value === "emprestado") {
                      setEmprestando(true);
                      requestAnimationFrame(() => destinoRef.current?.focus());
                    } else {
                      abrir(false);
                      onAplicar(s.value, null);
                    }
                  }}
                >
                  {s.label}
                  {s.value === "emprestado" && (
                    <span className="text-muted-foreground">…</span>
                  )}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Adicionar etiqueta: escolhe uma existente ou cria a digitada. */
function MenuAdicionarEtiqueta({
  etiquetas,
  onEscolher,
  disabled,
}: {
  etiquetas: string[];
  onEscolher: (etiqueta: string) => void;
  disabled: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const buscaRef = useRef<HTMLInputElement>(null);
  const nova = busca.trim();
  const existe = etiquetas.some((e) => e.toLowerCase() === nova.toLowerCase());

  function escolher(valor: string) {
    setAberto(false);
    setBusca("");
    onEscolher(valor);
  }

  return (
    <Popover
      open={aberto}
      onOpenChange={(a) => {
        setAberto(a);
        if (!a) setBusca("");
      }}
    >
      <Gatilho disabled={disabled}>Adicionar etiqueta</Gatilho>
      <PopoverContent
        side="top"
        align="start"
        initialFocus={buscaRef}
        className="w-60 p-0"
      >
        <Command filter={filtroBusca}>
          <CommandInput
            ref={buscaRef}
            value={busca}
            onValueChange={setBusca}
            placeholder="Etiqueta…"
          />
          <CommandList>
            <CommandEmpty>Digite o nome da etiqueta.</CommandEmpty>
            {nova && !existe && (
              <CommandItem
                value="__nova__"
                keywords={[nova]}
                onSelect={() => escolher(nova)}
              >
                <Plus aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  Adicionar “{nova}”
                </span>
              </CommandItem>
            )}
            {etiquetas.map((e, i) => (
              <CommandItem
                key={e}
                value={String(i)}
                keywords={[e]}
                onSelect={() => escolher(e)}
              >
                <span className="min-w-0 flex-1 truncate">{e}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Barra fixa no rodapé da lista com as ações para os itens selecionados. */
export function BarraEmMassa({
  ids,
  etiquetasDaSelecao,
  locais,
  categorias,
  pessoas,
  etiquetas,
  onLimpar,
}: {
  ids: string[];
  /** Etiquetas presentes nos itens selecionados. */
  etiquetasDaSelecao: string[];
  locais: LocalRow[];
  categorias: CategoriaRow[];
  pessoas: PessoaRow[];
  /** Todas as etiquetas em uso, para sugerir ao adicionar. */
  etiquetas: string[];
  onLimpar: () => void;
}) {
  const [executando, startExecutar] = useTransition();
  const [troca, setTroca] = useState<{
    categoriaId: string;
    rotulo: string;
    removidos: { chave: string; itens: number }[];
  } | null>(null);

  const porId = useMemo(
    () => new Map(categorias.map((c) => [c.id, c])),
    [categorias],
  );
  const opcoesLoc = useMemo(
    () => [
      { id: SEM_LOCAL, busca: ["Sem local"], conteudo: <SemLocalTag /> },
      ...opcoesLocal(locais),
    ],
    [locais],
  );
  const opcoesCat = useMemo(() => opcoesCategoria(categorias), [categorias]);
  const opcoesPessoa = useMemo(
    () => [
      { value: "", label: "Nenhuma" },
      ...pessoas.map((p) => ({ value: p.id, label: p.nome })),
    ],
    [pessoas],
  );

  const total = ids.length;
  const excedeu = total > LIMITE_EM_MASSA;
  const bloqueado = executando || excedeu;

  function executar(acao: () => Promise<ResultadoMassa>, depois?: () => void) {
    startExecutar(async () => {
      const res = await acao();
      if (!res.ok) {
        toast.error(res.erro);
        return;
      }
      toast.success(
        `${itens(res.total)} ${res.total === 1 ? "atualizado" : "atualizados"}`,
      );
      depois?.();
      onLimpar();
    });
  }

  function escolherCategoria(categoriaId: string | null) {
    if (!categoriaId) return;
    const categoria = porId.get(categoriaId);
    if (!categoria) return;
    startExecutar(async () => {
      const previa = await previaAlterarCategoria(ids, categoriaId);
      if (!previa.ok) {
        toast.error(previa.erro);
        return;
      }
      setTroca({
        categoriaId,
        rotulo: rotuloCategoria(categoria, porId),
        removidos: previa.removidos,
      });
    });
  }

  return (
    <div
      role="region"
      aria-label="Ações para os itens selecionados"
      className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-popover p-2 text-sm shadow-lg"
    >
      <span className="px-1 font-medium tabular-nums" aria-live="polite">
        {total} {total === 1 ? "selecionado" : "selecionados"}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onLimpar}
        disabled={executando}
      >
        Limpar seleção
      </Button>
      {excedeu ? (
        <span className="text-destructive">
          Máximo de {LIMITE_EM_MASSA} itens por ação. Reduza a seleção.
        </span>
      ) : (
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      )}

      <Combobox
        valor={null}
        opcoes={opcoesLoc}
        onChange={(local) => {
          if (local)
            executar(() => moverItens(ids, local === SEM_LOCAL ? null : local));
        }}
        placeholder="Mover para…"
        disabled={bloqueado}
        vazio="Nenhum local encontrado."
        className="w-44"
      />
      <Combobox
        valor={null}
        opcoes={opcoesCat}
        onChange={escolherCategoria}
        placeholder="Alterar categoria…"
        disabled={bloqueado}
        vazio="Nenhuma categoria encontrada."
        className="w-48"
      />
      <MenuSituacao
        disabled={bloqueado}
        onAplicar={(situacao, destino) =>
          executar(() => alterarSituacaoItens(ids, situacao, destino))
        }
      />
      <MenuAcao
        rotulo="Frequência de uso"
        opcoes={FREQUENCIAS.map(({ value, label }) => ({ value, label }))}
        disabled={bloqueado}
        onEscolher={(v) => executar(() => alterarFrequenciaItens(ids, v))}
      />
      <MenuAcao
        rotulo="Estado"
        opcoes={ESTADOS.map(({ value, label }) => ({ value, label }))}
        disabled={bloqueado}
        onEscolher={(v) => executar(() => alterarEstadoItens(ids, v))}
      />
      {pessoas.length > 0 && (
        <MenuAcao
          rotulo="Atribuir pessoa"
          opcoes={opcoesPessoa}
          disabled={bloqueado}
          vazio="Nenhuma pessoa encontrada."
          onEscolher={(v) =>
            executar(() => atribuirPessoaItens(ids, v || null))
          }
        />
      )}
      <MenuAdicionarEtiqueta
        etiquetas={etiquetas}
        disabled={bloqueado}
        onEscolher={(e) => executar(() => adicionarEtiquetaItens(ids, e))}
      />
      <MenuAcao
        rotulo="Remover etiqueta"
        opcoes={etiquetasDaSelecao.map((e) => ({ value: e, label: e }))}
        disabled={bloqueado || etiquetasDaSelecao.length === 0}
        vazio="Nenhuma etiqueta encontrada."
        onEscolher={(e) => executar(() => removerEtiquetaItens(ids, e))}
      />

      <AlertDialog
        open={troca !== null}
        onOpenChange={(a) => {
          if (!a && !executando) setTroca(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              {itens(total)} {total === 1 ? "passará" : "passarão"} para{" "}
              {troca?.rotulo}.
            </AlertDialogDescription>
            {troca && troca.removidos.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Atributos que serão removidos:{" "}
                {troca.removidos
                  .map((r) => `${r.chave} (${itens(r.itens)})`)
                  .join(", ")}
                .
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executando}>
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={executando}
              onClick={() => {
                if (!troca) return;
                const { categoriaId } = troca;
                executar(
                  () => alterarCategoriaItens(ids, categoriaId),
                  () => setTroca(null),
                );
              }}
            >
              {executando ? "Alterando…" : "Alterar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
