export function EnderecoTag({
  endereco,
  className = "",
}: {
  endereco: string;
  className?: string;
}) {
  return (
    <span
      title={endereco}
      className={`${className} inline-block rounded-[4px] border border-border bg-label-tape px-2 py-0.5 font-mono text-[13px] leading-snug tracking-[0.02em] text-foreground`}
    >
      {endereco}
    </span>
  );
}

export function SemLocalTag() {
  return (
    <span className="inline-block rounded-[4px] border border-dashed border-border px-2 py-0.5 font-mono text-[13px] leading-snug tracking-[0.02em] text-muted-foreground">
      Sem local
    </span>
  );
}
