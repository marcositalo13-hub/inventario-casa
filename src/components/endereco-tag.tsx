export function EnderecoTag({ endereco }: { endereco: string }) {
  return (
    <span className="inline-block rounded-[4px] border border-border bg-label-tape px-2 py-0.5 font-mono text-[13px] leading-snug tracking-[0.02em] text-foreground">
      {endereco}
    </span>
  );
}
