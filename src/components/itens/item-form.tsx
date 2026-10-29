"use client";

import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { criarItem, editarItem } from "@/app/(app)/itens/actions";
import { Combobox } from "@/components/itens/combobox";
import { ExcluirItem } from "@/components/itens/excluir-item";
import { opcoesCategoria, opcoesLocal } from "@/components/itens/opcoes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ItemRow, PessoaRow } from "@/lib/itens-data";
import {
  ESTADOS,
  FREQUENCIAS,
  NATUREZAS,
  SITUACOES,
  formatDecimalBR,
  formatMoedaBR,
  naturezaDaCategoria,
  parseDecimalBR,
  schemaEfetivo,
  type AtributoDef,
  type CategoriaRow,
  type ItemInput,
  type Natureza,
  type Situacao,
} from "@/lib/itens";
import type { LocalRow } from "@/lib/locais";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Estado do formulário
// ---------------------------------------------------------------------------

type ValorAtributo = string | boolean | string[];

type Campos = {
  nome: string;
  categoriaId: string | null;
  localId: string | null;
  quantidade: string;
  unidade: string;
  marca: string;
  modelo: string;
  pessoaId: string | null;
  frequenciaUso: string | null;
  estado: string | null;
  situacao: Situacao;
  emprestadoPara: string;
  natureza: Natureza;
  dataAquisicao: string;
  garantiaAte: string;
  valorPago: string;
  etiquetas: string[];
  observacoes: string;
  atributos: Record<string, ValorAtributo>;
};

type CampoObrigatorio = "nome" | "categoria" | "local" | "quantidade" | "unidade" | "emprestadoPara";

function camposVazios(): Campos {
  return {
    nome: "",
    categoriaId: null,
    localId: null,
    quantidade: "1",
    unidade: "un",
    marca: "",
    modelo: "",
    pessoaId: null,
    frequenciaUso: null,
    estado: null,
    situacao: "guardado",
    emprestadoPara: "",
    natureza: "duravel",
    dataAquisicao: "",
    garantiaAte: "",
    valorPago: "",
    etiquetas: [],
    observacoes: "",
    atributos: {},
  };
}

function camposDoItem(item: ItemRow, schema: AtributoDef[]): Campos {
  const atributos: Record<string, ValorAtributo> = {};
  for (const def of schema) {
    const v = item.atributos[def.chave];
    if (v === undefined) continue;
    atributos[def.chave] = typeof v === "number" ? formatDecimalBR(v) : v;
  }
  return {
    nome: item.nome,
    categoriaId: item.categoria_id,
    localId: item.local_id,
    quantidade: formatDecimalBR(item.quantidade),
    unidade: item.unidade,
    marca: item.marca ?? "",
    modelo: item.modelo ?? "",
    pessoaId: item.pessoa_id,
    frequenciaUso: item.frequencia_uso,
    estado: item.estado,
    situacao: item.situacao,
    emprestadoPara: item.emprestado_para ?? "",
    natureza: item.natureza,
    dataAquisicao: item.data_aquisicao ?? "",
    garantiaAte: item.garantia_ate ?? "",
    valorPago: formatMoedaBR(item.valor_pago),
    etiquetas: item.etiquetas,
    observacoes: item.observacoes ?? "",
    atributos,
  };
}

// ---------------------------------------------------------------------------
// Seção "Detalhes": aberta/fechada lembrada no localStorage
// ---------------------------------------------------------------------------

const CHAVE_DETALHES = "itens:detalhes-aberto";
const EVENTO_DETALHES = "itens:detalhes-aberto";
// Vale quando o localStorage está indisponível (modo privado, bloqueado).
let detalhesNaMemoria: boolean | null = null;

function lerDetalhes(): boolean {
  if (detalhesNaMemoria !== null) return detalhesNaMemoria;
  try {
    return window.localStorage.getItem(CHAVE_DETALHES) === "1";
  } catch {
    return false;
  }
}

function gravarDetalhes(aberto: boolean) {
  detalhesNaMemoria = aberto;
  try {
    window.localStorage.setItem(CHAVE_DETALHES, aberto ? "1" : "0");
  } catch {
    // Sem armazenamento: fica só na memória desta aba.
  }
  window.dispatchEvent(new Event(EVENTO_DETALHES));
}

function assinarDetalhes(aviso: () => void) {
  window.addEventListener(EVENTO_DETALHES, aviso);
  return () => window.removeEventListener(EVENTO_DETALHES, aviso);
}

function useDetalhesAberto() {
  return useSyncExternalStore(assinarDetalhes, lerDetalhes, () => false);
}

// ---------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------

const NENHUM = { value: null, label: "—" };

export function ItemForm({
  categorias,
  locais,
  pessoas,
  item,
}: {
  categorias: CategoriaRow[];
  locais: LocalRow[];
  pessoas: PessoaRow[];
  /** Presente na edição. */
  item?: ItemRow;
}) {
  const router = useRouter();
  const editando = item !== undefined;

  const porId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const opcoesCat = useMemo(() => opcoesCategoria(categorias), [categorias]);
  const opcoesLoc = useMemo(() => opcoesLocal(locais), [locais]);

  const [campos, setCampos] = useState<Campos>(() => {
    if (!item) return camposVazios();
    const categoria = porId.get(item.categoria_id);
    return camposDoItem(item, categoria ? schemaEfetivo(categoria, porId) : []);
  });
  const [erro, setErro] = useState<{ campo: CampoObrigatorio; mensagem: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const detalhesAberto = useDetalhesAberto();

  const nomeRef = useRef<HTMLInputElement>(null);
  const categoriaRef = useRef<HTMLButtonElement>(null);
  const localRef = useRef<HTMLButtonElement>(null);
  const quantidadeRef = useRef<HTMLInputElement>(null);
  const unidadeRef = useRef<HTMLInputElement>(null);
  const emprestadoRef = useRef<HTMLInputElement>(null);

  const categoria = campos.categoriaId ? porId.get(campos.categoriaId) : undefined;
  const schema = useMemo(
    () => (categoria ? schemaEfetivo(categoria, porId) : []),
    [categoria, porId],
  );
  const local = locais.find((l) => l.id === campos.localId);

  function set<K extends keyof Campos>(campo: K, valor: Campos[K]) {
    setCampos((atual) => ({ ...atual, [campo]: valor }));
  }

  function escolherCategoria(id: string | null) {
    const nova = id ? porId.get(id) : undefined;
    setErro(null);
    setCampos((atual) => {
      if (!nova) return { ...atual, categoriaId: null, atributos: {} };
      const chaves = new Set(schemaEfetivo(nova, porId).map((a) => a.chave));
      const atributos = Object.fromEntries(
        Object.entries(atual.atributos).filter(([chave]) => chaves.has(chave)),
      );
      return {
        ...atual,
        categoriaId: nova.id,
        natureza: naturezaDaCategoria(nova, porId),
        atributos,
      };
    });
  }

  function setAtributo(chave: string, valor: ValorAtributo) {
    setCampos((atual) => ({ ...atual, atributos: { ...atual.atributos, [chave]: valor } }));
  }

  function falhar(campo: CampoObrigatorio, mensagem: string) {
    setErro({ campo, mensagem });
    const refs = {
      nome: nomeRef,
      categoria: categoriaRef,
      local: localRef,
      quantidade: quantidadeRef,
      unidade: unidadeRef,
      emprestadoPara: emprestadoRef,
    };
    // Depois do render: "Emprestado para" pode ainda estar sendo exibido.
    requestAnimationFrame(() => refs[campo].current?.focus());
  }

  async function enviar(outro: boolean) {
    if (salvando) return;
    if (!campos.nome.trim()) return falhar("nome", "Informe o nome.");
    if (!campos.categoriaId) return falhar("categoria", "Escolha a categoria.");
    if (!campos.localId) return falhar("local", "Escolha o local.");
    const qtd = parseDecimalBR(campos.quantidade);
    if (!qtd.ok || qtd.numero == null || qtd.numero < 0) {
      return falhar("quantidade", "Quantidade deve ser um número maior ou igual a 0.");
    }
    if (!campos.unidade.trim()) return falhar("unidade", "Informe a unidade.");
    if (campos.situacao === "emprestado" && !campos.emprestadoPara.trim()) {
      if (!detalhesAberto) gravarDetalhes(true);
      return falhar("emprestadoPara", "Informe para quem o item foi emprestado.");
    }

    setErro(null);
    setSalvando(true);
    const input: ItemInput = {
      ...campos,
      categoriaId: campos.categoriaId,
      localId: campos.localId,
    };
    const res = editando ? await editarItem(item.id, input) : await criarItem(input);
    setSalvando(false);

    if (!res.ok) {
      toast.error(res.erro);
      return;
    }
    toast.success("Item salvo");

    if (outro) {
      const mantida = campos.categoriaId ? porId.get(campos.categoriaId) : undefined;
      setCampos({
        ...camposVazios(),
        categoriaId: campos.categoriaId,
        localId: campos.localId,
        pessoaId: campos.pessoaId,
        unidade: campos.unidade,
        natureza: mantida ? naturezaDaCategoria(mantida, porId) : "duravel",
      });
      nomeRef.current?.focus();
    } else {
      router.push("/itens");
    }
  }

  function aoEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    void enviar(!editando && submitter?.getAttribute("name") === "outro");
  }

  function aoTeclar(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void enviar(!editando);
    }
  }

  const invalido = (campo: CampoObrigatorio) => erro?.campo === campo || undefined;

  return (
    <div className="mt-6 flex flex-col gap-4">
      {local && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {local.itens} {local.itens === 1 ? "item" : "itens"} neste local
        </p>
      )}

      <form
        onSubmit={aoEnviar}
        onKeyDown={aoTeclar}
        noValidate
        className="flex flex-col gap-6"
      >
        {/* Obrigatórios */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-nome">Nome</Label>
            <Input
              ref={nomeRef}
              id="item-nome"
              autoFocus
              autoComplete="off"
              value={campos.nome}
              aria-invalid={invalido("nome")}
              onChange={(e) => set("nome", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="item-categoria">Categoria</Label>
            <Combobox
              id="item-categoria"
              triggerRef={categoriaRef}
              valor={campos.categoriaId}
              opcoes={opcoesCat}
              onChange={escolherCategoria}
              placeholder="Escolha a categoria"
              vazio="Nenhuma categoria encontrada."
              invalido={invalido("categoria")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="item-local">Local</Label>
            <Combobox
              id="item-local"
              triggerRef={localRef}
              valor={campos.localId}
              opcoes={opcoesLoc}
              onChange={(id) => {
                setErro(null);
                set("localId", id);
              }}
              placeholder="Escolha o local"
              vazio="Nenhum local encontrado."
              invalido={invalido("local")}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-quantidade">Quantidade</Label>
              <Input
                ref={quantidadeRef}
                id="item-quantidade"
                inputMode="decimal"
                autoComplete="off"
                value={campos.quantidade}
                aria-invalid={invalido("quantidade")}
                onChange={(e) => set("quantidade", e.target.value)}
                className="w-32"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-unidade">Unidade</Label>
              <Input
                ref={unidadeRef}
                id="item-unidade"
                autoComplete="off"
                value={campos.unidade}
                aria-invalid={invalido("unidade")}
                onChange={(e) => set("unidade", e.target.value)}
                className="w-32"
              />
            </div>
          </div>
        </div>

        {/* Detalhes */}
        <section className="flex flex-col gap-4">
          <button
            type="button"
            aria-expanded={detalhesAberto}
            aria-controls="item-detalhes"
            onClick={() => gravarDetalhes(!detalhesAberto)}
            className="-ml-1 flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-sm font-semibold hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronRight
              size={16}
              aria-hidden
              className={cn("text-muted-foreground", detalhesAberto && "rotate-90")}
            />
            Detalhes
          </button>

          {detalhesAberto && (
            <div id="item-detalhes" className="grid gap-4 sm:grid-cols-2">
              <CampoTexto
                id="item-marca"
                rotulo="Marca"
                valor={campos.marca}
                onChange={(v) => set("marca", v)}
              />
              <CampoTexto
                id="item-modelo"
                rotulo="Modelo"
                valor={campos.modelo}
                onChange={(v) => set("modelo", v)}
              />

              <div className="flex flex-col gap-2">
                <Label htmlFor="item-pessoa">Pessoa</Label>
                {pessoas.length === 0 ? (
                  <Select disabled value={null}>
                    <SelectTrigger id="item-pessoa" className="w-full">
                      <SelectValue placeholder="Nenhuma pessoa cadastrada" />
                    </SelectTrigger>
                  </Select>
                ) : (
                  <CampoSelect
                    id="item-pessoa"
                    valor={campos.pessoaId}
                    itens={[NENHUM, ...pessoas.map((p) => ({ value: p.id, label: p.nome }))]}
                    onChange={(v) => set("pessoaId", v)}
                  />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="item-frequencia">Frequência de uso</Label>
                <CampoSelect
                  id="item-frequencia"
                  valor={campos.frequenciaUso}
                  itens={[NENHUM, ...FREQUENCIAS]}
                  onChange={(v) => set("frequenciaUso", v)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="item-estado">Estado</Label>
                <CampoSelect
                  id="item-estado"
                  valor={campos.estado}
                  itens={[NENHUM, ...ESTADOS]}
                  onChange={(v) => set("estado", v)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="item-situacao">Situação</Label>
                <CampoSelect
                  id="item-situacao"
                  valor={campos.situacao}
                  itens={SITUACOES}
                  onChange={(v) => {
                    if (!v) return;
                    set("situacao", v as Situacao);
                    if (v === "emprestado") {
                      requestAnimationFrame(() => emprestadoRef.current?.focus());
                    }
                  }}
                />
              </div>

              {campos.situacao === "emprestado" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="item-emprestado">Emprestado para</Label>
                  <Input
                    ref={emprestadoRef}
                    id="item-emprestado"
                    autoComplete="off"
                    value={campos.emprestadoPara}
                    aria-invalid={invalido("emprestadoPara")}
                    onChange={(e) => set("emprestadoPara", e.target.value)}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="item-natureza">Natureza</Label>
                <CampoSelect
                  id="item-natureza"
                  valor={campos.natureza}
                  itens={NATUREZAS}
                  onChange={(v) => v && set("natureza", v as Natureza)}
                />
              </div>

              <CampoTexto
                id="item-aquisicao"
                rotulo="Data de aquisição"
                type="date"
                valor={campos.dataAquisicao}
                onChange={(v) => set("dataAquisicao", v)}
              />
              <CampoTexto
                id="item-garantia"
                rotulo="Garantia até"
                type="date"
                valor={campos.garantiaAte}
                onChange={(v) => set("garantiaAte", v)}
              />

              <div className="flex flex-col gap-2">
                <Label htmlFor="item-valor">Valor pago</Label>
                <Input
                  id="item-valor"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  value={campos.valorPago}
                  onChange={(e) => set("valorPago", e.target.value)}
                  onBlur={() => {
                    const n = parseDecimalBR(campos.valorPago);
                    if (n.ok && n.numero != null) set("valorPago", formatMoedaBR(n.numero));
                  }}
                />
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="item-etiquetas">Etiquetas</Label>
                <Etiquetas
                  id="item-etiquetas"
                  valores={campos.etiquetas}
                  onChange={(v) => set("etiquetas", v)}
                />
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="item-observacoes">Observações</Label>
                <Textarea
                  id="item-observacoes"
                  value={campos.observacoes}
                  onChange={(e) => set("observacoes", e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
        </section>

        {/* Atributos da categoria */}
        {schema.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">Atributos da categoria</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {schema.map((def) => (
                <CampoAtributo
                  key={def.chave}
                  def={def}
                  valor={campos.atributos[def.chave]}
                  onChange={(v) => setAtributo(def.chave, v)}
                />
              ))}
            </div>
          </section>
        )}

        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro.mensagem}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {/* "Salvar" vem primeiro no DOM para ser o botão acionado pelo Enter. */}
          <Button type="submit" name="salvar" disabled={salvando}>
            Salvar
          </Button>
          {!editando && (
            <Button type="submit" name="outro" variant="outline" disabled={salvando}>
              Salvar e cadastrar outro
              <kbd className="ml-1 font-sans text-xs text-muted-foreground">Ctrl+Enter</kbd>
            </Button>
          )}
          {editando && (
            <div className="ml-auto">
              <ExcluirItem
                id={item.id}
                nome={item.nome}
                endereco={locais.find((l) => l.id === item.local_id)?.endereco ?? ""}
              />
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------

function CampoTexto({
  id,
  rotulo,
  valor,
  onChange,
  type = "text",
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  type?: "text" | "date";
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        type={type}
        autoComplete="off"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CampoSelect({
  id,
  valor,
  itens,
  onChange,
}: {
  id: string;
  valor: string | null;
  itens: readonly { value: string | null; label: string }[];
  onChange: (valor: string | null) => void;
}) {
  return (
    <Select items={itens} value={valor} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {itens.map((i) => (
          <SelectItem key={i.value ?? ""} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** "eletrica_fio" → "eletrica fio". */
function rotuloOpcao(opcao: string) {
  return opcao.replaceAll("_", " ");
}

function CampoAtributo({
  def,
  valor,
  onChange,
}: {
  def: AtributoDef;
  valor: ValorAtributo | undefined;
  onChange: (valor: ValorAtributo) => void;
}) {
  const id = `atributo-${def.chave}`;

  switch (def.tipo) {
    case "texto":
    case "numero":
      return (
        <div className="flex flex-col gap-2">
          <Label htmlFor={id}>{def.rotulo}</Label>
          <Input
            id={id}
            autoComplete="off"
            inputMode={def.tipo === "numero" ? "decimal" : undefined}
            value={typeof valor === "string" ? valor : ""}
            aria-invalid={
              (def.tipo === "numero" &&
                typeof valor === "string" &&
                !parseDecimalBR(valor).ok) ||
              undefined
            }
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case "lista": {
      const itens = [
        NENHUM,
        ...(def.opcoes ?? []).map((o) => ({ value: o, label: rotuloOpcao(o) })),
      ];
      return (
        <div className="flex flex-col gap-2">
          <Label htmlFor={id}>{def.rotulo}</Label>
          <CampoSelect
            id={id}
            valor={typeof valor === "string" && valor !== "" ? valor : null}
            itens={itens}
            onChange={(v) => onChange(v ?? "")}
          />
        </div>
      );
    }

    case "multilista": {
      const marcados = Array.isArray(valor) ? valor : [];
      return (
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-2 text-sm leading-none font-medium">{def.rotulo}</legend>
          <div className="flex flex-wrap gap-1.5">
            {(def.opcoes ?? []).map((o) => {
              const ativo = marcados.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() =>
                    onChange(ativo ? marcados.filter((m) => m !== o) : [...marcados, o])
                  }
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    ativo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-surface-hover",
                  )}
                >
                  {rotuloOpcao(o)}
                </button>
              );
            })}
          </div>
        </fieldset>
      );
    }

    case "booleano":
      return (
        <label className="flex items-center gap-2 self-end py-2 text-sm">
          <Checkbox checked={valor === true} onCheckedChange={(c) => onChange(c)} />
          {def.rotulo}
        </label>
      );
  }
}

function Etiquetas({
  id,
  valores,
  onChange,
}: {
  id: string;
  valores: string[];
  onChange: (valores: string[]) => void;
}) {
  const [rascunho, setRascunho] = useState("");

  function adicionar() {
    const t = rascunho.trim();
    if (t && !valores.some((v) => v.toLowerCase() === t.toLowerCase())) {
      onChange([...valores, t]);
    }
    setRascunho("");
  }

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input px-2 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {valores.map((v) => (
        <span
          key={v}
          className="flex items-center gap-1 rounded-[4px] bg-label-tape px-1.5 py-0.5 text-sm"
        >
          {v}
          <button
            type="button"
            aria-label={`Remover etiqueta ${v}`}
            onClick={() => onChange(valores.filter((x) => x !== v))}
            className="rounded text-muted-foreground hover:text-foreground"
          >
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        autoComplete="off"
        value={rascunho}
        placeholder={valores.length ? "" : "Digite e tecle Enter"}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={adicionar}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            adicionar();
          } else if (e.key === "Backspace" && rascunho === "" && valores.length) {
            e.preventDefault();
            onChange(valores.slice(0, -1));
          }
        }}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
