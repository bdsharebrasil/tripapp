/** Valores digitados em português; a tela conserva o texto até terminar a edição. */
export function valorDespesa(texto: string): number {
  const value = texto
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (!value) return 0;
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  if (!/^\d+(?:\.\d*)?$/.test(normalized)) return NaN;
  return Number(normalized);
}
export type ItemDespesaEnvio = {
  id: string;
  categoria: string;
  data: string;
  valor: number;
  pago_por: string;
  descricao: string;
};
/** IDs estáveis são obrigatórios para edição e vínculo dos comprovantes no servidor. */
export function payloadDespesas(items: ItemDespesaEnvio[]) {
  return {
    despesas: items.map(
      ({ id, categoria, data, valor, pago_por, descricao }) => ({
        id,
        categoria,
        data,
        valor,
        pago_por,
        descricao: descricao.trim(),
      }),
    ),
  };
}
