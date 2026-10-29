"use client";

import { ArvoreLocais } from "@/components/locais/arvore-locais";
import { TabelaSiglas } from "@/components/locais/tabela-siglas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LocalRow, TipoLocal } from "@/lib/locais";

export function LocaisView({
  tipos,
  locais,
}: {
  tipos: TipoLocal[];
  locais: LocalRow[];
}) {
  return (
    <Tabs defaultValue="locais" className="mt-6 gap-6">
      <TabsList variant="line" className="h-7 gap-3 p-0">
        <TabsTrigger value="locais" className="flex-none px-0 text-sm font-normal">
          Locais
        </TabsTrigger>
        <TabsTrigger value="siglas" className="flex-none px-0 text-sm font-normal">
          Siglas
        </TabsTrigger>
      </TabsList>
      <TabsContent value="locais">
        <ArvoreLocais tipos={tipos} locais={locais} />
      </TabsContent>
      <TabsContent value="siglas">
        <TabelaSiglas tipos={tipos} locais={locais} />
      </TabsContent>
    </Tabs>
  );
}
