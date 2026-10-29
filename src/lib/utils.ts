export { cn } from "cn"

/** Texto aparado; vazio (ou não-texto) vira null. */
export function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null
  const t = valor.trim()
  return t === "" ? null : t
}
