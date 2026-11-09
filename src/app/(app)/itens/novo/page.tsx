import { Suspense } from "react";
import { ItemForm } from "@/components/itens/item-form";
import {
  carregarCategorias,
  carregarPessoas,
  contarItensSemLocal,
} from "@/lib/itens-data";
import { carregarLocais } from "@/lib/locais-data";
import { createClient } from "@/lib/supabase/server";

async function Formulario() {
  const supabase = await createClient();
  const [{ locais }, categorias, pessoas, semLocal] = await Promise.all([
    carregarLocais(supabase),
    carregarCategorias(supabase),
    carregarPessoas(supabase),
    contarItensSemLocal(supabase),
  ]);
  return <ItemForm categorias={categorias} locais={locais} pessoas={pessoas} semLocal={semLocal} />;
}

export default function NovoItemPage() {
  return (
    <div data-largura="ampla">
      <h1 className="text-3xl font-semibold">Novo item</h1>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">Carregando…</p>}>
        <Formulario />
      </Suspense>
    </div>
  );
}
