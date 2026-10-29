"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { excluirItem } from "@/app/(app)/itens/actions";
import { EnderecoTag } from "@/components/endereco-tag";
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

export function ExcluirItem({
  id,
  nome,
  endereco,
}: {
  id: string;
  nome: string;
  endereco: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [excluindo, startExcluir] = useTransition();

  function confirmar() {
    startExcluir(async () => {
      const res = await excluirItem(id);
      if (!res.ok) {
        toast.error(res.erro);
        return;
      }
      toast.success("Item excluído");
      setAberto(false);
      router.push("/itens");
    });
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setAberto(true)}>
        <Trash2 aria-hidden />
        Excluir
      </Button>
      <AlertDialog
        open={aberto}
        onOpenChange={(a) => {
          if (!excluindo) setAberto(a);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col items-start gap-2">
            <p className="font-medium">{nome}</p>
            {endereco && <EnderecoTag endereco={endereco} />}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmar} disabled={excluindo}>
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
