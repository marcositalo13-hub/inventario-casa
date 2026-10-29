import { Suspense } from "react";
import { sair } from "@/app/actions";
import { Button } from "@/components/ui/button";
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
    <>
      <p>Conectado como {user?.email}</p>
      <p>Categorias no banco: {error ? "erro" : count}</p>
      <form action={sair}>
        <Button type="submit" variant="outline">
          Sair
        </Button>
      </form>
    </>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <Suspense fallback={<p>Carregando…</p>}>
        <Painel />
      </Suspense>
    </main>
  );
}
