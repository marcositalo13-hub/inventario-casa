import { Suspense } from "react";
import { ItemForm } from "@/components/itens/item-form";
import { carregarCategorias, carregarPessoas } from "@/lib/itens-data";
import { carregarLocais } from "@/lib/locais-data";
import { createClient } from "@/lib/supabase/server";

async function Formulario() {
  const supabase = await createClient();
  const [{ locais }, categorias, pessoas] = await Promise.all([
    carregarLocais(supabase),
    carregarCategorias(supabase),
    carregarPessoas(supabase),
  ]);
  return <ItemForm categorias={categorias} locais={locais} pessoas={pessoas} />;
}

export default function NovoItemPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Novo item</h1>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">Carregando…</p>}>
        <Formulario />
      </Suspense>
    </>
  );
}
