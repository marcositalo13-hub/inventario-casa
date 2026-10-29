import { Suspense } from "react";
import { LocaisView } from "@/components/locais/locais-view";
import { carregarLocais } from "@/lib/locais-data";
import { createClient } from "@/lib/supabase/server";

async function Conteudo() {
  const supabase = await createClient();
  const { tipos, locais } = await carregarLocais(supabase);
  return <LocaisView tipos={tipos} locais={locais} />;
}

export default function LocaisPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Locais</h1>
      <Suspense
        fallback={<p className="mt-6 text-muted-foreground">Carregando…</p>}
      >
        <Conteudo />
      </Suspense>
    </>
  );
}
