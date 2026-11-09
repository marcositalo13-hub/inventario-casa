import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ItemForm } from "@/components/itens/item-form";
import { UUID_REGEX } from "@/lib/itens";
import { hrefVoltar } from "@/lib/itens-filtros";
import {
  carregarCategorias,
  carregarItem,
  carregarPessoas,
  contarItensSemLocal,
} from "@/lib/itens-data";
import { carregarLocais } from "@/lib/locais-data";
import { createClient } from "@/lib/supabase/server";

async function Formulario({
  params,
  searchParams,
}: {
  params: PageProps<"/itens/[id]">["params"];
  searchParams: PageProps<"/itens/[id]">["searchParams"];
}) {
  const { id } = await params;
  const voltar = hrefVoltar((await searchParams).voltar);
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
      voltar={voltar}
    />
  );
}

export default function EditarItemPage({ params, searchParams }: PageProps<"/itens/[id]">) {
  return (
    <div data-largura="ampla">
      <h1 className="text-3xl font-semibold">Editar item</h1>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">Carregando…</p>}>
        <Formulario params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
