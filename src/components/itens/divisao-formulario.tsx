"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useGroupRef, type Layout } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

// Formulário de item + painel lateral, lado a lado com divisor arrastável a
// partir de 1100px; abaixo disso, o painel fica embaixo do formulário.

const CHAVE = "item-form-split";
const LARGO = "(min-width: 1100px)";

function assinarLargura(aviso: () => void) {
  const consulta = window.matchMedia(LARGO);
  consulta.addEventListener("change", aviso);
  return () => consulta.removeEventListener("change", aviso);
}

function useLargo() {
  // No servidor, supõe tela larga (o caso comum); o cliente corrige.
  return useSyncExternalStore(
    assinarLargura,
    () => window.matchMedia(LARGO).matches,
    () => true,
  );
}

// Tamanhos salvos (localStorage pode estar indisponível: modo privado, bloqueado).

function lerSalvo(): string | null {
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function gravar(layout: Layout | null) {
  try {
    if (layout) window.localStorage.setItem(CHAVE, JSON.stringify(layout));
    else window.localStorage.removeItem(CHAVE);
  } catch {
    // Sem armazenamento: o tamanho vale só até recarregar.
  }
}

function layoutValido(bruto: string | null): Layout | undefined {
  if (!bruto) return undefined;
  try {
    const dados: unknown = JSON.parse(bruto);
    if (
      dados &&
      typeof dados === "object" &&
      typeof (dados as Layout).formulario === "number" &&
      typeof (dados as Layout).painel === "number"
    ) {
      return dados as Layout;
    }
  } catch {
    // Valor corrompido: usa o padrão.
  }
  return undefined;
}

export function DivisaoFormulario({
  formulario,
  painel,
}: {
  formulario: ReactNode;
  /** Recebe as classes de posição do painel para o layout atual. */
  painel: (className: string) => ReactNode;
}) {
  const largo = useLargo();
  const grupo = useGroupRef();

  // O servidor desenha o padrão; no cliente, aplica o tamanho salvo. Feito pela
  // API do grupo (e não por key/defaultLayout) para não remontar o formulário.
  useEffect(() => {
    if (!largo) return;
    const salvo = layoutValido(lerSalvo());
    if (salvo) grupo.current?.setLayout(salvo);
  }, [largo, grupo]);

  if (!largo) {
    return (
      <div className="mt-6 flex flex-col gap-8">
        {formulario}
        {painel("border-t border-border")}
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      groupRef={grupo}
      orientation="horizontal"
      onLayoutChanged={(layout, meta) => {
        // Só o que o usuário fez; a montagem inicial não sobrescreve o salvo.
        if (meta.isUserInteraction) gravar(layout);
      }}
      // O painel lateral é sticky em relação à janela: nada de overflow aqui.
      style={{ height: "auto", overflow: "visible" }}
      className="mt-6"
    >
      <ResizablePanel
        id="formulario"
        defaultSize="62"
        minSize="40"
        style={{ overflow: "visible" }}
      >
        <div className="pr-6">{formulario}</div>
      </ResizablePanel>
      <ResizableHandle
        withHandle
        aria-label="Redimensionar formulário e painel"
        // Duplo clique volta ao padrão (feito pela biblioteca); esquece o salvo.
        onDoubleClick={() => gravar(null)}
        className="cursor-col-resize after:w-2 focus-visible:ring-2 [&>div]:opacity-0 hover:[&>div]:opacity-100 focus-visible:[&>div]:opacity-100"
      />
      <ResizablePanel
        id="painel"
        defaultSize="38"
        minSize="22"
        maxSize="55"
        style={{ overflow: "visible" }}
      >
        {painel("sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto")}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
