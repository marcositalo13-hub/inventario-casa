"use client";

import { useEffect, useRef, useState } from "react";
import {
  buscarItensParaLocal,
  conteudoLocal,
  sugerirLocais,
} from "@/app/(app)/itens/painel-actions";
import { EnderecoTag } from "@/components/endereco-tag";
import { Input } from "@/components/ui/input";
import {
  MIN_BUSCA,
  palavrasSignificativas,
  type ConteudoLocal,
  type ItemComLocal,
  type RespostaPainel,
  type SugestaoLocal,
} from "@/lib/painel-local";
import type { LocalRow } from "@/lib/locais";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Consulta com espera, cache e uma chamada por vez
// ---------------------------------------------------------------------------

/**
 * Busca `chave` depois de `atraso` ms sem mudança. Resultados ficam em cache
 * enquanto o painel existir. Só uma chamada fica em andamento por vez: as server
 * actions são enviadas uma a uma pelo cliente, e uma fila de prévias atrasaria o
 * Salvar. Ao terminar, a chamada segue para a chave desejada mais recente.
 */
function useConsulta<T>(
  chave: string | null,
  atraso: number,
  buscar: (chave: string) => Promise<RespostaPainel<T>>,
) {
  const [cache, setCache] = useState<ReadonlyMap<string, T>>(() => new Map());
  const [exibida, setExibida] = useState<string | null>(null);
  const [erro, setErro] = useState<{ chave: string; mensagem: string } | null>(null);
  const desejada = useRef<string | null>(null);
  const conhecidas = useRef(new Map<string, T>());
  const ocupada = useRef(false);

  useEffect(() => {
    desejada.current = chave;
    if (chave === null || conhecidas.current.has(chave)) return;
    const timer = setTimeout(async () => {
      if (ocupada.current) return;
      ocupada.current = true;
      let alvo = desejada.current;
      try {
        while (alvo !== null && !conhecidas.current.has(alvo)) {
          const resposta = await buscar(alvo);
          if (!resposta.ok) {
            setErro({ chave: alvo, mensagem: resposta.erro });
            break;
          }
          conhecidas.current.set(alvo, resposta.dados);
          setCache(new Map(conhecidas.current));
          if (desejada.current === alvo) setExibida(alvo);
          alvo = desejada.current;
        }
      } catch {
        if (alvo !== null) {
          setErro({ chave: alvo, mensagem: "Não foi possível carregar." });
        }
      } finally {
        ocupada.current = false;
      }
    }, atraso);
    return () => clearTimeout(timer);
  }, [chave, atraso, buscar]);

  const atual = chave !== null ? cache.get(chave) : undefined;
  const anterior = exibida !== null ? cache.get(exibida) : undefined;
  return {
    dados: atual ?? anterior,
    /** Mostrando o resultado de outra chave enquanto a atual carrega. */
    desatualizado: atual === undefined && anterior !== undefined,
    carregando: chave !== null && atual === undefined,
    erro: atual === undefined && erro?.chave === chave ? erro.mensagem : null,
  };
}

// Chaves: o texto inteiro da consulta, para o cache e para a busca.

type ChaveSugestao = { c: string | null; p: string[]; x: string | null };
type ChaveConteudo = { l: string; x: string | null };
type ChaveBusca = { t: string; x: string | null };

function buscarSugestoes(chave: string) {
  const { c, p, x }: ChaveSugestao = JSON.parse(chave);
  return sugerirLocais({ categoriaId: c, nome: p.join(" "), excluirItemId: x });
}

function buscarConteudo(chave: string) {
  const { l, x }: ChaveConteudo = JSON.parse(chave);
  return conteudoLocal(l, x);
}

function buscarItens(chave: string) {
  const { t, x }: ChaveBusca = JSON.parse(chave);
  return buscarItensParaLocal(t, x);
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

function contagem(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Painel à direita do formulário, com a busca "Guardar junto de…" sempre no
 * topo. Abaixo dela mostra, em ordem de prioridade: o conteúdo do local
 * destacado na lista aberta; os resultados da busca, quando há termo; onde
 * estão itens parecidos, enquanto não há local ou o usuário edita
 * nome/categoria; o conteúdo do local escolhido.
 */
export function PainelLocal({
  nome,
  categoriaId,
  localId,
  previaLocalId,
  editandoNomeOuCategoria,
  excluirItemId,
  locais,
  onEscolherLocal,
  className,
}: {
  nome: string;
  categoriaId: string | null;
  localId: string | null;
  /** Opção destacada na lista de locais aberta. */
  previaLocalId: string | null;
  editandoNomeOuCategoria: boolean;
  excluirItemId: string | null;
  locais: LocalRow[];
  onEscolherLocal: (id: string) => void;
  className?: string;
}) {
  const [termo, setTermo] = useState("");
  const termoBusca = termo.trim();
  const buscando = termoBusca.length >= MIN_BUSCA;

  const localConteudo =
    previaLocalId ??
    (!buscando && !editandoNomeOuCategoria && localId ? localId : null);
  const modo = localConteudo ? "conteudo" : buscando ? "busca" : "parecidos";

  const palavras = palavrasSignificativas(nome).sort();
  const chaveSugestao =
    modo === "parecidos" && (categoriaId || palavras.length)
      ? JSON.stringify({ c: categoriaId, p: palavras, x: excluirItemId } satisfies ChaveSugestao)
      : null;
  const chaveConteudo = localConteudo
    ? JSON.stringify({ l: localConteudo, x: excluirItemId } satisfies ChaveConteudo)
    : null;

  const chaveBusca =
    modo === "busca"
      ? JSON.stringify({ t: termoBusca, x: excluirItemId } satisfies ChaveBusca)
      : null;

  // Nome: 300ms sem digitar; local destacado: 150ms parado; busca: 250ms.
  const sugestoes = useConsulta(chaveSugestao, 300, buscarSugestoes);
  const conteudo = useConsulta(chaveConteudo, 150, buscarConteudo);
  const busca = useConsulta(chaveBusca, 250, buscarItens);

  // Usa o local, limpa a busca e o painel passa a mostrar o conteúdo dele.
  function usarLocal(id: string) {
    onEscolherLocal(id);
    setTermo("");
  }

  // Resultados que valem para o termo atual (não os de um termo anterior).
  const resultados = !busca.desatualizado && !busca.carregando ? busca.dados : undefined;

  return (
    <aside
      aria-label="Ajuda para escolher o local"
      className={cn("bg-sidebar p-4 text-sm", className)}
    >
      <div className="mb-4 flex flex-col gap-2 border-b border-border pb-4">
        <label htmlFor="painel-busca" className="font-semibold">
          Guardar junto de…
        </label>
        <Input
          id="painel-busca"
          type="search"
          autoComplete="off"
          placeholder="Buscar item por nome, marca ou modelo"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const primeiro = resultados?.[0];
            if (primeiro) usarLocal(primeiro.localId);
          }}
          className="bg-background"
        />
      </div>
      {modo === "busca" ? (
        <ResultadosBusca consulta={busca} onUsar={usarLocal} />
      ) : modo === "parecidos" ? (
        <Parecidos
          ativo={chaveSugestao !== null}
          consulta={sugestoes}
          localId={localId}
          onEscolher={onEscolherLocal}
        />
      ) : (
        <Conteudo
          endereco={locais.find((l) => l.id === localConteudo)?.endereco ?? ""}
          consulta={conteudo}
          localId={localId}
          onEscolher={onEscolherLocal}
        />
      )}
    </aside>
  );
}

type Consulta<T> = ReturnType<typeof useConsulta<T>>;

function Estado({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

/**
 * Linha inteira clicável (e acionável por teclado) que escolhe um local, com a
 * dica "usar" no hover/foco. O clique não tira o foco do campo em edição.
 */
function LinhaUsar({
  ativo,
  rotulo,
  onUsar,
  children,
}: {
  /** O local desta linha é o escolhido no formulário. */
  ativo: boolean;
  /** Nome acessível da ação. */
  rotulo: string;
  onUsar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      aria-pressed={ativo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onUsar}
      className={cn(
        "group flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        ativo && "bg-surface-hover",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">{children}</span>
      <span
        aria-hidden
        className="shrink-0 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        usar
      </span>
    </button>
  );
}

/** EnderecoTag + caminho, que quebra linha em vez de cortar. */
function LinhaEndereco({ endereco, caminho }: { endereco: string; caminho: string }) {
  return (
    <span className="flex min-w-0 items-start gap-2">
      <EnderecoTag endereco={endereco} className="shrink-0" />
      <span className="min-w-0 pt-0.5 break-words text-muted-foreground">{caminho}</span>
    </span>
  );
}

function Parecidos({
  ativo,
  consulta,
  localId,
  onEscolher,
}: {
  ativo: boolean;
  consulta: Consulta<SugestaoLocal[]>;
  localId: string | null;
  onEscolher: (id: string) => void;
}) {
  const { dados, desatualizado, carregando, erro } = consulta;

  let corpo: React.ReactNode;
  if (!ativo) {
    corpo = <Estado>Digite o nome ou escolha a categoria para ver sugestões.</Estado>;
  } else if (erro) {
    corpo = <Estado>{erro}</Estado>;
  } else if (!dados) {
    corpo = <Estado>Carregando…</Estado>;
  } else if (dados.length === 0 && !desatualizado) {
    corpo = <Estado>Nenhum item parecido cadastrado ainda.</Estado>;
  } else {
    corpo = (
      <ul className={cn("-mx-2 flex flex-col", desatualizado && "opacity-60")}>
        {dados.map((s) => (
          <li key={s.localId}>
            <LinhaUsar
              ativo={s.localId === localId}
              rotulo={`Usar o local ${s.endereco}`}
              onUsar={() => onEscolher(s.localId)}
            >
              <LinhaEndereco endereco={s.endereco} caminho={s.caminhoNomes} />
              <span className="text-xs">
                {contagem(s.parecidos, "item parecido", "itens parecidos")}
              </span>
              {s.exemplos.length > 0 && (
                <span className="text-xs text-muted-foreground">{s.exemplos.join(", ")}</span>
              )}
            </LinhaUsar>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline justify-between gap-2 font-semibold">
        Onde estão itens parecidos
        {ativo && carregando && dados && (
          <span className="text-xs font-normal text-muted-foreground">Atualizando…</span>
        )}
      </h2>
      {corpo}
    </section>
  );
}

function ResultadosBusca({
  consulta,
  onUsar,
}: {
  consulta: Consulta<ItemComLocal[]>;
  onUsar: (localId: string) => void;
}) {
  const { dados, desatualizado, erro } = consulta;

  if (erro) return <Estado>{erro}</Estado>;
  if (!dados) return <Estado>Buscando…</Estado>;
  if (dados.length === 0 && !desatualizado) {
    return <Estado>Nenhum item com local encontrado.</Estado>;
  }
  return (
    <ul className={cn("-mx-2 flex flex-col", desatualizado && "opacity-60")}>
      {dados.map((r) => (
        <li key={r.id}>
          <LinhaUsar
            ativo={false}
            rotulo={`Usar o local de ${r.nome}: ${r.endereco}`}
            onUsar={() => onUsar(r.localId)}
          >
            <span className="break-words">{r.nome}</span>
            <LinhaEndereco endereco={r.endereco} caminho={r.caminhoNomes} />
          </LinhaUsar>
        </li>
      ))}
    </ul>
  );
}

function Conteudo({
  endereco,
  consulta,
  localId,
  onEscolher,
}: {
  endereco: string;
  consulta: Consulta<ConteudoLocal>;
  localId: string | null;
  onEscolher: (id: string) => void;
}) {
  const { dados, desatualizado, erro } = consulta;
  const vazio = dados && dados.itens.length === 0 && dados.filhos.length === 0;

  let corpo: React.ReactNode;
  if (erro) {
    corpo = <Estado>{erro}</Estado>;
  } else if (!dados) {
    corpo = <Estado>Carregando…</Estado>;
  } else if (vazio && !desatualizado) {
    corpo = <Estado>Local vazio.</Estado>;
  } else {
    // Local filho: escolhe o filho. Item: escolhe o local mostrado.
    corpo = (
      <ul className={cn("-mx-2 flex flex-col", desatualizado && "opacity-60")}>
        {dados.filhos.map((f) => (
          <li key={f.id}>
            <LinhaUsar
              ativo={f.id === localId}
              rotulo={`Usar o local ${f.endereco}`}
              onUsar={() => onEscolher(f.id)}
            >
              <span>
                <span className="font-mono text-[13px]">{f.codigo}</span>
                <span className="text-muted-foreground">
                  {` · ${contagem(f.itens, "item", "itens")}`}
                </span>
              </span>
            </LinhaUsar>
          </li>
        ))}
        {dados.itens.map((i) => (
          <li key={i.id}>
            <LinhaUsar
              ativo={false}
              rotulo={`Usar o local ${dados.endereco}, onde está ${i.nome}`}
              onUsar={() => onEscolher(dados.localId)}
            >
              <span className="flex min-w-0 items-baseline justify-between gap-2">
                <span className="break-words">{i.nome}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {i.quantidade}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">{i.categoria}</span>
            </LinhaUsar>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
        Conteúdo de
        {endereco && <EnderecoTag endereco={endereco} />}
        {dados && !desatualizado && (
          <span className="text-xs font-normal text-muted-foreground">
            {contagem(dados.total, "item", "itens")}
          </span>
        )}
      </h2>
      {corpo}
    </section>
  );
}
