"use client";

import { useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  criarSigla,
  editarSigla,
  excluirSigla,
} from "@/app/(app)/locais/actions";
import { IconeAcao } from "@/components/locais/icone-acao";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SIGLA_REGEX, type LocalRow, type TipoLocal } from "@/lib/locais";

export function TabelaSiglas({
  tipos,
  locais,
}: {
  tipos: TipoLocal[];
  locais: LocalRow[];
}) {
  const usos = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of locais) m.set(l.tipo_sigla, (m.get(l.tipo_sigla) ?? 0) + 1);
    return m;
  }, [locais]);

  const [editando, setEditando] = useState<TipoLocal | null>(null);
  const [aExcluir, setAExcluir] = useState<TipoLocal | null>(null);
  const [excluindo, startExcluir] = useTransition();

  function confirmarExclusao() {
    if (!aExcluir) return;
    const alvo = aExcluir;
    startExcluir(async () => {
      const res = await excluirSigla(alvo.sigla);
      if (res.ok) {
        toast.success(`Sigla ${alvo.sigla} excluída.`);
        setAExcluir(null);
      } else {
        toast.error(res.erro);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <NovaSigla />

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-24">Sigla</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead className="w-24">Cômodo</TableHead>
            <TableHead className="w-24 text-right">Locais</TableHead>
            <TableHead className="w-20">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tipos.map((t) => (
            <TableRow
              key={t.sigla}
              className="group hover:bg-surface-hover focus-within:bg-surface-hover"
            >
              <TableCell className="py-1 font-mono text-[13px]">{t.sigla}</TableCell>
              <TableCell className="py-1">{t.nome}</TableCell>
              <TableCell className="py-1 text-muted-foreground">
                {t.eh_comodo ? "Sim" : "Não"}
              </TableCell>
              <TableCell className="py-1 text-right text-muted-foreground tabular-nums">
                {usos.get(t.sigla) ?? 0}
              </TableCell>
              <TableCell className="py-1">
                <span className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                  <IconeAcao
                    icon={Pencil}
                    label={`Editar nome de ${t.sigla}`}
                    onClick={() => setEditando(t)}
                  />
                  <IconeAcao
                    icon={Trash2}
                    label={`Excluir ${t.sigla}`}
                    onClick={() => setAExcluir(t)}
                  />
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={editando !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setEditando(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {editando && (
            <EditarNome
              key={editando.sigla}
              tipo={editando}
              onDone={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={aExcluir !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !excluindo) setAExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sigla?</AlertDialogTitle>
            <AlertDialogDescription>
              {aExcluir && (
                <>
                  <span className="font-mono">{aExcluir.sigla}</span> ·{" "}
                  {aExcluir.nome}. Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
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

function NovaSigla() {
  const [sigla, setSigla] = useState("");
  const [nome, setNome] = useState("");
  const [ehComodo, setEhComodo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const siglaRef = useRef<HTMLInputElement>(null);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!SIGLA_REGEX.test(sigla)) {
      setErro("Sigla deve ter de 2 a 4 letras maiúsculas (A–Z).");
      siglaRef.current?.focus();
      return;
    }
    if (!nome.trim()) {
      setErro("Informe o nome.");
      return;
    }

    setErro(null);
    setSalvando(true);
    const res = await criarSigla({ sigla, nome, ehComodo });
    setSalvando(false);

    if (!res.ok) {
      toast.error(res.erro);
      return;
    }
    toast.success(`Sigla ${sigla} adicionada.`);
    setSigla("");
    setNome("");
    setEhComodo(false);
    siglaRef.current?.focus();
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sigla-nova">Sigla</Label>
          <Input
            ref={siglaRef}
            id="sigla-nova"
            autoComplete="off"
            maxLength={4}
            placeholder="ABC"
            value={sigla}
            aria-invalid={(sigla !== "" && !SIGLA_REGEX.test(sigla)) || undefined}
            onChange={(e) =>
              setSigla(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))
            }
            className="w-24 font-mono"
          />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <Label htmlFor="sigla-nome">Nome</Label>
          <Input
            id="sigla-nome"
            autoComplete="off"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <label className="flex h-8 items-center gap-2 text-sm">
          <Checkbox
            checked={ehComodo}
            onCheckedChange={(checked) => setEhComodo(checked)}
          />
          Cômodo
        </label>
        <Button type="submit" disabled={salvando}>
          <Plus aria-hidden />
          Adicionar
        </Button>
      </div>
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
    </form>
  );
}

function EditarNome({ tipo, onDone }: { tipo: TipoLocal; onDone: () => void }) {
  const [nome, setNome] = useState(tipo.nome);
  const [salvando, setSalvando] = useState(false);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    setSalvando(true);
    const res = await editarSigla({ sigla: tipo.sigla, nome });
    setSalvando(false);
    if (!res.ok) {
      toast.error(res.erro);
      return;
    }
    toast.success(`Sigla ${tipo.sigla} atualizada.`);
    onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-semibold">
          Editar <span className="font-mono">{tipo.sigla}</span>
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sigla-editar-nome">Nome</Label>
          <Input
            id="sigla-editar-nome"
            autoFocus
            autoComplete="off"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={salvando}>
            Salvar
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
