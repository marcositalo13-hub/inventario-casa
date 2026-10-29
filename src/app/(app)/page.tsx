import { Suspense } from "react";
import { EnderecoTag } from "@/components/endereco-tag";
import { createClient } from "@/lib/supabase/server";

async function Painel() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count, error } = await supabase
    .from("categorias")
    .select("*", { count: "exact", head: true });

  return (
    <div className="mt-2 flex flex-col gap-1">
      <p className="text-muted-foreground">Conectado como {user?.email}</p>
      <p>Categorias no banco: {error ? "erro" : count}</p>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Início</h1>
      <Suspense fallback={<p className="mt-2 text-muted-foreground">Carregando…</p>}>
        <Painel />
      </Suspense>
      <div className="mt-8 flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Exemplo de endereço</p>
        <div>
          <EnderecoTag endereco="QRT-01 ARM-MOD-01-GAV-01" />
        </div>
      </div>
    </>
  );
}
