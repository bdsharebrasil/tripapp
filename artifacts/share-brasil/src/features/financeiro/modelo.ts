export type PagamentoFolha = {
  id: string;
  competencia_ano: number;
  competencia_mes: number;
  rotulo?: string;
  tipo_pagamento?: string;
  valor_centavos: number;
  status: string;
  data_pagamento?: string;
  data_prevista?: string;
  holerite_url?: string | null;
  comprovante_url?: string | null;
};

export type RelatorioReembolso = {
  id: string;
  numero_relatorio?: string;
  numero_voo?: string;
  rota?: string;
  status?: string;
  data_inicio?: string;
  data_fim?: string;
  criado_em?: string;
  pagamento_status?: string;
  pagamento_total?: number;
  pagamento_valor?: number;
  pagamento_data?: string;
  data_pagamento?: string;
};

export type Origem = "folha" | "reembolso";
export type Situacao = "recebido" | "previsto" | "cancelado";

export type Recebimento = {
  id: string;
  origem: Origem;
  titulo: string;
  detalhe: string;
  valorCentavos: number;
  situacao: Situacao;
  status: string;
  data: string;
  competencia: string;
  holeriteUrl?: string | null;
  comprovanteUrl?: string | null;
  relatorioId?: string;
};

const PAGOS = new Set(["PAGO", "PAGA", "QUITADO", "LIQUIDADO", "REALIZADO"]);
const CANCELADOS = new Set(["CANCELADO", "CANCELADA", "ESTORNADO"]);

const chave = (status?: string) =>
  String(status || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

export const situacaoDe = (status?: string): Situacao =>
  PAGOS.has(chave(status))
    ? "recebido"
    : CANCELADOS.has(chave(status))
      ? "cancelado"
      : "previsto";

const centavos = (reais?: number) => Math.round(Number(reais || 0) * 100);

export function deFolha(p: PagamentoFolha): Recebimento {
  const mes = String(p.competencia_mes).padStart(2, "0");
  return {
    id: `folha-${p.id}`,
    origem: "folha",
    titulo: p.rotulo || p.tipo_pagamento || "Pagamento",
    detalhe: `Competência ${mes}/${p.competencia_ano}`,
    valorCentavos: Number(p.valor_centavos || 0),
    situacao: situacaoDe(p.status),
    status: p.status,
    data: String(p.data_pagamento || p.data_prevista || "").slice(0, 10),
    competencia: `${p.competencia_ano}-${mes}`,
    holeriteUrl: p.holerite_url,
    comprovanteUrl: p.comprovante_url,
  };
}

/** Reembolsos usam os mesmos campos do Início: pago = pagamento_valor, restante = total − pago. */
export function deReembolso(r: RelatorioReembolso): Recebimento[] {
  const status = chave(r.pagamento_status);
  if (!status || status === "NAO_PROGRAMADO") return [];
  const total = centavos(r.pagamento_total);
  const pagoInformado = centavos(r.pagamento_valor);
  const pago = PAGOS.has(status) && !pagoInformado ? total : pagoInformado;
  const restante = Math.max(0, total - pago);
  const data = String(
    r.pagamento_data ||
      r.data_pagamento ||
      r.data_fim ||
      r.data_inicio ||
      r.criado_em ||
      "",
  ).slice(0, 10);
  const base = {
    origem: "reembolso" as const,
    titulo: "Reembolso",
    detalhe: [r.numero_relatorio, r.numero_voo && `Voo ${r.numero_voo}`]
      .filter(Boolean)
      .join(" · "),
    status: r.pagamento_status || "",
    data,
    competencia: data.slice(0, 7),
    relatorioId: r.id,
  };
  const itens: Recebimento[] = [];
  if (pago > 0)
    itens.push({
      ...base,
      id: `reembolso-${r.id}`,
      valorCentavos: pago,
      situacao: "recebido",
    });
  if (CANCELADOS.has(status))
    itens.push({
      ...base,
      id: `reembolso-${r.id}-cancelado`,
      valorCentavos: restante,
      situacao: "cancelado",
    });
  else if (restante > 0 && !PAGOS.has(status))
    itens.push({
      ...base,
      id: `reembolso-${r.id}-restante`,
      valorCentavos: restante,
      situacao: "previsto",
    });
  return itens;
}

export const moedaCentavos = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataCurta = (iso?: string) =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const nomeCompetencia = (competencia: string) => {
  const [ano, mes] = competencia.split("-");
  const nome = MESES[Number(mes) - 1];
  return nome ? `${nome} de ${ano}` : "Sem data";
};

export const mimeDoCaminho = (path: string): string => {
  const valor = decodeURIComponent(
    path.split("?key=").pop() || path,
  ).toLowerCase();
  return /\.jpe?g$/.test(valor)
    ? "image/jpeg"
    : /\.png$/.test(valor)
      ? "image/png"
      : /\.webp$/.test(valor)
        ? "image/webp"
        : "application/pdf";
};

export function agruparPorCompetencia(itens: Recebimento[]) {
  const grupos = new Map<string, Recebimento[]>();
  for (const item of [...itens].sort(
    (a, b) =>
      b.competencia.localeCompare(a.competencia) ||
      b.data.localeCompare(a.data),
  )) {
    const lista = grupos.get(item.competencia) || [];
    lista.push(item);
    grupos.set(item.competencia, lista);
  }
  return [...grupos.entries()];
}
