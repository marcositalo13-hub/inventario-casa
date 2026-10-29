"use client";

import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { criarLocal, editarLocal } from "@/app/(app)/locais/actions";
import { EnderecoTag } from "@/components/endereco-tag";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  enderecoFilho,
  formatCodigo,
  parseNumero,
  proximoNumero,
  type LocalNode,
  type LocalRow,
  type TipoLocal,
} from "@/lib/locais";

export type AlvoLocal =
  | { tipo: "adicionar"; pai: LocalNode | null }
  | { tipo: "editar"; local: LocalNode };

export function LocalDialog({
  open,
  onOpenChange,
  alvo,
  tipos,
  locais,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alvo: AlvoLocal;
  tipos: TipoLocal[];
  locais: LocalRow[];
}) {
  const editando = alvo.tipo === "editar";
  const parentId = editando ? alvo.local.parent_id : (alvo.pai?.id ?? null);
  const pai =
    (editando
      ? locais.find((l) => l.id === alvo.local.parent_id)
      : alvo.pai) ?? null;

  // Na raiz só cômodos; dentro de um local só tipos internos.
  const opcoes = tipos.filter((t) => t.eh_comodo === (parentId === null));
  const itens = opcoes.map((t) => ({
    value: t.sigla,
    label: `${t.sigla} · ${t.nome}`,
  }));

  const [tipo, setTipo] = useState<string | null>(
    editando ? alvo.local.tipo_sigla : null,
  );
  const [numero, setNumero] = useState(
    editando && alvo.local.numero != null ? String(alvo.local.numero) : "",
  );
  const [numeroTocado, setNumeroTocado] = useState(editando);
  const [descricao, setDescricao] = useState(
    editando ? (alvo.local.descricao ?? "") : "",
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const tipoRef = useRef<HTMLButtonElement>(null);
  const numeroRef = useRef<HTMLInputElement>(null);

  const numeroValido = parseNumero(numero);
  const codigo =
    tipo && numeroValido.ok ? formatCodigo(tipo, numeroValido.numero) : null;
  const preview = codigo ? enderecoFilho(pai, codigo) : null;

  function escolherTipo(valor: string | null) {
    setTipo(valor);
    setErro(null);
    if (!editando && !numeroTocado && valor) {
      const sugestao = proximoNumero(locais, parentId, valor);
      setNumero(sugestao == null ? "" : String(sugestao));
    }
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const outro =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("name") ===
      "outro";

    if (!tipo) {
      setErro("Escolha o tipo.");
      tipoRef.current?.focus();
      return;
    }
    const n = parseNumero(numero);
    if (!n.ok) {
      setErro("Número deve ser um inteiro de 1 a 99.");
      numeroRef.current?.focus();
      return;
    }

    setErro(null);
    setSalvando(true);
    const res = editando
      ? await editarLocal({
          id: alvo.local.id,
          tipoSigla: tipo,
          numero: n.numero,
          descricao,
        })
      : await criarLocal({
          parentId,
          tipoSigla: tipo,
          numero: n.numero,
          descricao,
        });
    setSalvando(false);

    if (!res.ok) {
      toast.error(res.erro);
      return;
    }

    toast.success(`${preview ?? formatCodigo(tipo, n.numero)} salvo.`);
    if (outro) {
      // Mesmo pai e tipo; próximo número.
      setNumero(n.numero != null && n.numero < 99 ? String(n.numero + 1) : "");
      setNumeroTocado(true);
      setDescricao("");
      numeroRef.current?.focus();
    } else {
      onOpenChange(false);
    }
  }

  const titulo = editando
    ? `Editar ${alvo.local.nome}`
    : pai
      ? "Adicionar local"
      : "Novo cômodo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent initialFocus={tipoRef} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{titulo}</DialogTitle>
          {pai && (
            <p className="text-sm text-muted-foreground">
              Dentro de <EnderecoTag endereco={pai.endereco} />
            </p>
          )}
        </DialogHeader>

        <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="local-tipo">Tipo</Label>
            <Select items={itens} value={tipo} onValueChange={escolherTipo}>
              <SelectTrigger ref={tipoRef} id="local-tipo" className="w-full">
                <SelectValue placeholder="Escolha o tipo" />
              </SelectTrigger>
              <SelectContent>
                {itens.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="local-numero">Número</Label>
            <Input
              ref={numeroRef}
              id="local-numero"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Opcional, 1 a 99"
              value={numero}
              aria-invalid={!numeroValido.ok || undefined}
              onChange={(e) => {
                setNumero(e.target.value.replace(/\D/g, "").slice(0, 2));
                setNumeroTocado(true);
              }}
              className="w-32"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="local-descricao">Descrição</Label>
            <Input
              id="local-descricao"
              autoComplete="off"
              placeholder="Opcional"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="flex min-h-6 items-center gap-2 text-sm text-muted-foreground">
            <span>Endereço:</span>
            {preview ? <EnderecoTag endereco={preview} /> : <span>—</span>}
          </div>

          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}

          {/* "Salvar" vem primeiro no DOM para ser o botão acionado pelo Enter. */}
          <DialogFooter className="sm:flex-row-reverse sm:justify-start">
            <Button type="submit" name="salvar" disabled={salvando}>
              Salvar
            </Button>
            {!editando && (
              <Button
                type="submit"
                name="outro"
                variant="outline"
                disabled={salvando}
              >
                Salvar e adicionar outro
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
