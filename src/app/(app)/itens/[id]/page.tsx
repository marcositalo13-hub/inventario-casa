import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ItemForm } from "@/components/itens/item-form";
import { UUID_REGEX } from "@/lib/itens";
import {
  carregarCategorias,
  carregarItem,
  carregarPessoas,
  contarItensSemLocal,
} from "@/lib/itens-data";
import { carregarLocais } from "@/lib/locais-data";
import { createClient } from "@/lib/supabase/server";

async function Formulario({ params }: { params: PageProps<"/itens/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  const supabase = await createClient();
  const [item, { locais }, categorias, pessoas, semLocal] = await Promise.all([
    carregarItem(supabase, id),
    carregarLocais(supabase),
    carregarCategorias(supabase),
    carregarPessoas(supabase),
    contarItensSemLocal(supabase),
  ]);
  if (!item) notFound();

  return (
    <ItemForm
      key={item.id}
      categorias={categorias}
      locais={locais}
      pessoas={pessoas}
      semLocal={semLocal}
      item={item}
    />
  );
}

export default function EditarItemPage({ params }: PageProps<"/itens/[id]">) {
  return (
    <>
      <h1 className="text-3xl font-semibold">Editar item</h1>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">Carregando…</p>}>
        <Formulario params={params} />
      </Suspense>
    </>
  );
}
