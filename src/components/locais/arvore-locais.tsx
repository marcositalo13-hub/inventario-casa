"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { excluirLocal } from "@/app/(app)/locais/actions";
import { EnderecoTag } from "@/components/endereco-tag";
import { IconeAcao } from "@/components/locais/icone-acao";
import { LocalDialog, type AlvoLocal } from "@/components/locais/local-dialog";
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
  buildTree,
  type LocalNode,
  type LocalRow,
  type TipoLocal,
} from "@/lib/locais";
import { cn } from "@/lib/utils";

export function ArvoreLocais({
  tipos,
  locais,
}: {
  tipos: TipoLocal[];
  locais: LocalRow[];
}) {
  const arvore = useMemo(() => buildTree(locais, tipos), [locais, tipos]);
  // Guarda os recolhidos: tudo começa expandido.
  const [recolhidos, setRecolhidos] = useState<Set<string>>(() => new Set());

  const [dialogAberto, setDialogAberto] = useState(false);
  const [alvo, setAlvo] = useState<AlvoLocal>({ tipo: "adicionar", pai: null });
  const [sessao, setSessao] = useState(0);

  const [aExcluir, setAExcluir] = useState<LocalNode | null>(null);
  const [excluindo, startExcluir] = useTransition();

  function abrir(novo: AlvoLocal) {
    setAlvo(novo);
    setSessao((s) => s + 1);
    setDialogAberto(true);
  }

  function alternar(id: string) {
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function confirmarExclusao() {
    if (!aExcluir) return;
    const local = aExcluir;
    startExcluir(async () => {
      const res = await excluirLocal(local.id);
      if (res.ok) {
        toast.success(`${local.endereco} excluído.`);
        setAExcluir(null);
      } else {
        toast.error(res.erro);
      }
    });
  }

  function renderNo(no: LocalNode) {
    const temFilhos = no.children.length > 0;
    const expandido = !recolhidos.has(no.id);

    return (
      <li key={no.id}>
        <div
          title={no.endereco}
          className="group flex min-h-8 items-center gap-2 rounded-md pr-1 hover:bg-surface-hover focus-within:bg-surface-hover"
          style={{ paddingLeft: no.depth * 24 + 4 }}
        >
          {temFilhos ? (
            <button
              type="button"
              onClick={() => alternar(no.id)}
              aria-expanded={expandido}
              aria-label={expandido ? `Recolher ${no.nome}` : `Expandir ${no.nome}`}
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ChevronRight
                size={14}
                aria-hidden
                className={cn(expandido && "rotate-90")}
              />
            </button>
          ) : (
            <span className="size-5 shrink-0" aria-hidden />
          )}
          <EnderecoTag endereco={no.codigo} />
          <span className="shrink-0 text-sm">{no.nome}</span>
          {no.descricao && (
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              {no.descricao}
            </span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {no.itens > 0 && (
              <span className="text-sm text-muted-foreground">
                {no.itens} {no.itens === 1 ? "item" : "itens"}
              </span>
            )}
            <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
              <IconeAcao
                icon={Plus}
                label="Adicionar dentro"
                onClick={() => abrir({ tipo: "adicionar", pai: no })}
              />
              <IconeAcao
                icon={Pencil}
                label="Editar"
                onClick={() => abrir({ tipo: "editar", local: no })}
              />
              <IconeAcao
                icon={Trash2}
                label="Excluir"
                onClick={() => setAExcluir(no)}
              />
            </span>
          </span>
        </div>
        {temFilhos && expandido && <ul>{no.children.map(renderNo)}</ul>}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => abrir({ tipo: "adicionar", pai: null })}>
          <Plus aria-hidden />
          Novo cômodo
        </Button>
      </div>

      {arvore.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhum local cadastrado. Comece pelo primeiro cômodo.
        </p>
      ) : (
        <ul className="flex flex-col">{arvore.map(renderNo)}</ul>
      )}

      <LocalDialog
        key={sessao}
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        alvo={alvo}
        tipos={tipos}
        locais={locais}
      />

      <AlertDialog
        open={aExcluir !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !excluindo) setAExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir local?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {aExcluir && (
            <div>
              <EnderecoTag endereco={aExcluir.endereco} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={confirmarExclusao}
              disabled={excluindo}
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
