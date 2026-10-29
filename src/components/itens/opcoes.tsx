import { EnderecoTag } from "@/components/endereco-tag";
import type { OpcaoCombobox } from "@/components/itens/combobox";
import { rotuloCategoria, type CategoriaRow } from "@/lib/itens";
import type { LocalRow } from "@/lib/locais";

/** Cada categoria de topo seguida de suas subcategorias ("Sub · Cat"). */
export function opcoesCategoria(categorias: CategoriaRow[]): OpcaoCombobox[] {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const ordenadas = categorias
    .filter((c) => c.parent_id === null)
    .flatMap((topo) => [topo, ...categorias.filter((c) => c.parent_id === topo.id)]);

  return ordenadas.map((c) => {
    const texto = rotuloCategoria(c, porId);
    return { id: c.id, busca: [texto], conteudo: <span className="truncate">{texto}</span> };
  });
}

export function ConteudoLocal({ local }: { local: Pick<LocalRow, "endereco" | "caminho_nomes"> }) {
  return (
    <>
      <EnderecoTag endereco={local.endereco} />
      <span className="min-w-0 truncate text-muted-foreground">{local.caminho_nomes}</span>
    </>
  );
}

export function opcoesLocal(locais: LocalRow[]): OpcaoCombobox[] {
  return [...locais]
    .sort((a, b) => a.endereco.localeCompare(b.endereco, "pt-BR"))
    .map((l) => ({
      id: l.id,
      busca: [l.endereco, l.caminho_nomes],
      conteudo: <ConteudoLocal local={l} />,
    }));
}
