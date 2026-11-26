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

export function formatarDataDiaMes(dataISO: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) return "";
  const [year, month, day] = dataISO.split("-").map(Number);
  const data = new Date(Date.UTC(year, month - 1, day));
  if (
    data.getUTCFullYear() !== year ||
    data.getUTCMonth() !== month - 1 ||
    data.getUTCDate() !== day
  ) {
    return "";
  }
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

export function dataDespesaDeDiaMes(
  diaMes: string,
  ano: number,
): string | null {
  const match = /^(\d{2})\/(\d{2})$/.exec(diaMes);
  if (!match || !Number.isInteger(ano) || ano < 1000 || ano > 9999) {
    return null;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const data = new Date(Date.UTC(ano, month - 1, day));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== month - 1 ||
    data.getUTCDate() !== day
  ) {
    return null;
  }
  return `${ano}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
