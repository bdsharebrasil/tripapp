import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/src/lib/api";

export type Cores = ReturnType<typeof useColors>;
export type RegraVoo = "I" | "V" | "Y" | "Z";
export type TipoVoo = "S" | "N" | "G" | "M" | "X";
export type Esteira = "L" | "M" | "H" | "J";
export type StatusPlano =
  | "rascunho"
  | "preparado"
  | "enviado"
  | "aprovado"
  | "cancelado";

export type FormularioIcao = {
  identificacao: string;
  regraVoo: RegraVoo;
  tipoVoo: TipoVoo;
  numeroAeronaves: string;
  tipoAeronave: string;
  esteira: Esteira;
  equipamento: string;
  adep: string;
  eobt: string;
  velocidade: string;
  nivel: string;
  rota: string;
  ades: string;
  eet: string;
  alternado1: string;
  alternado2: string;
  outrasInformacoes: string;
  autonomia: string;
  pessoasABordo: string;
  radioEmergencia: string;
  sobrevivencia: string;
  coletes: string;
  botes: string;
  corAeronave: string;
  observacoes: string;
  piloto: string;
};

export type NovoPlano = {
  numeroVoo: string;
  solicitacaoId: string;
  partida: string;
  chegada: string;
  trecho: string;
  data: string;
  aeronave: string;
  aeronaveId: string;
  matricula: string;
  horaPrevista: string;
  estimativaVoo: string;
  combustivelPrevisto: number;
  alternates: string;
  passageiros: number;
  peso: number;
  piloto: string;
  copiloto: string;
  observacoes: string;
  condicoes: string;
  fpl: FormularioIcao;
  status: StatusPlano;
};
export type PlanoVoo = NovoPlano & { id: string };

export type PlanoRegistro = {
  id: string;
  numero_voo: string;
  adep: string;
  ades: string;
  data_voo: string;
  eobt: string;
  created_at: string;
  payload: {
    form?: Partial<NovoPlano> & Partial<FormularioIcao> & { dataVoo?: string };
    contexto?: {
      solicitacao_id?: string | number;
      solicitacao?: {
        id?: string | number;
        numero_voo?: string | null;
        aeronave_id?: string | null;
        matricula_registro?: string | null;
        modelo?: string | null;
        piloto_nome?: string | null;
        copiloto_nome?: string | null;
      } | null;
      aeronave?: {
        matricula_registro?: string | null;
        modelo?: string | null;
      } | null;
    } | null;
  } | null;
};

export type FormularioPlano = Omit<
  NovoPlano,
  | "numeroVoo"
  | "solicitacaoId"
  | "combustivelPrevisto"
  | "passageiros"
  | "peso"
  | "fpl"
  | "status"
> & {
  combustivelPrevisto: string;
  passageiros: string;
  peso: string;
};

export type Clima = {
  loc?: string;
  metar?: string;
  taf?: string;
  source?: string;
  error?: string;
};
export type Ponto = { icao: string; name: string; lat: number; lon: number };
export type PlanoRota = {
  flightplan?: {
    adep?: string;
    ades?: string;
    route?: string;
    route_source?: string;
    distance_nm?: number;
    estimated_time?: string;
    flight_minutes?: number;
    cruise_speed?: number;
  };
  performance?: {
    modelo?: string;
    tipo_aeronave?: string;
    velocidade_cruzeiro_kt?: number;
    equipamentos_icao?: string;
    vigilancia_icao?: string;
    pbn_icao?: string;
  } | null;
  fuel?: {
    total_required?: number;
    trip_liters?: number;
    reserve_liters?: number;
    taxi_liters?: number;
    reserve_min?: number;
  };
  departure?: Ponto;
  destination?: Ponto;
  alternates?: { icao: string; name: string; distance_km: number }[];
  notam_alerts?: {
    icao?: string;
    number?: string;
    message?: string;
    start?: string;
    end?: string;
  }[];
  error?: string;
};

export type AeronaveSolicitacao = {
  id: string;
  registration?: string;
  matricula?: string;
  matricula_registro?: string;
  model?: string;
  modelo?: string;
  manufacturer?: string;
  fabricante?: string;
  tipo_aeronave?: string;
  fuel_consumption?: number;
};

export type VooSolicitacao = {
  solicitacao_id?: string | number;
  id?: string | number;
  numero_voo: string;
  origem?: string;
  destino?: string;
  data_agendada?: string;
  data_fim?: string;
  horario_previsto_agendamento?: string | null;
  numero_passageiros?: number | null;
  passageiros?: string[];
  status?: string | null;
  aeronave_id?: string | null;
  matricula_registro?: string | null;
  modelo?: string | null;
  tipo_aeronave?: string | null;
  piloto_id?: string | null;
  copiloto_id?: string | null;
  piloto_nome?: string | null;
  copiloto_nome?: string | null;
  matricula?: string;
};
export type PessoaTripulacao = {
  id: string;
  nome_completo?: string;
  nome?: string;
};

export const ICAO = /^[A-Z]{4}$/;
export const CONDICOES = ["VMC", "IMC", "IFR", "VFR"];
export const STATUS_CONFIG: Record<
  StatusPlano,
  { label: string; color: string }
> = {
  rascunho: { label: "Rascunho", color: "#94A3B8" },
  preparado: { label: "Pronto para envio manual", color: "#38BDF8" },
  enviado: { label: "Situação informada como enviado", color: "#F59E0B" },
  aprovado: { label: "Situação informada como aprovado", color: "#22C55E" },
  cancelado: { label: "Cancelado", color: "#EF4444" },
};

export const hoje = () => new Date().toISOString().split("T")[0];
export function formatarHoraUtc(valor?: string | null) {
  const horaSemSeparador = valor?.trim().match(/^(\d{2})(\d{2})Z?$/i);
  if (horaSemSeparador) {
    const horas = Number(horaSemSeparador[1]);
    const minutos = Number(horaSemSeparador[2]);
    return horas <= 23 && minutos <= 59
      ? `${horaSemSeparador[1]}:${horaSemSeparador[2]}`
      : "";
  }

  const correspondencia = valor?.match(
    /(?:^|[T\s])(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|([+-])(\d{2}):?(\d{2}))?$/i,
  );
  if (!correspondencia) return "";

  const horas = Number(correspondencia[1]);
  const minutos = Number(correspondencia[2]);
  if (horas > 23 || minutos > 59) return "";

  let totalMinutos = horas * 60 + minutos;
  if (correspondencia[4]) {
    const sinal = correspondencia[4] === "+" ? 1 : -1;
    const horaOffset = Number(correspondencia[5]);
    const minutoOffset = Number(correspondencia[6]);
    if (horaOffset > 23 || minutoOffset > 59) return "";
    totalMinutos -= sinal * (horaOffset * 60 + minutoOffset);
  }
  totalMinutos = (totalMinutos + 1440) % 1440;

  return `${String(Math.floor(totalMinutos / 60)).padStart(2, "0")}:${String(
    totalMinutos % 60,
  ).padStart(2, "0")}`;
}
export const criarFormulario = (): FormularioPlano => ({
  partida: "",
  chegada: "",
  trecho: "",
  data: hoje(),
  aeronave: "",
  aeronaveId: "",
  matricula: "",
  horaPrevista: "",
  estimativaVoo: "",
  combustivelPrevisto: "",
  alternates: "",
  passageiros: "0",
  peso: "",
  piloto: "",
  copiloto: "",
  observacoes: "",
  condicoes: "VMC",
});

export const criarFormularioIcao = (): FormularioIcao => ({
  identificacao: "",
  regraVoo: "V",
  tipoVoo: "G",
  numeroAeronaves: "1",
  tipoAeronave: "",
  esteira: "L",
  equipamento: "",
  adep: "",
  eobt: "",
  velocidade: "",
  nivel: "",
  rota: "",
  ades: "",
  eet: "",
  alternado1: "",
  alternado2: "",
  outrasInformacoes: "",
  autonomia: "",
  pessoasABordo: "",
  radioEmergencia: "",
  sobrevivencia: "",
  coletes: "",
  botes: "",
  corAeronave: "",
  observacoes: "",
  piloto: "",
});

export const buscarClima = (icao: string) =>
  apiFetch<Clima>(`/api/v1/weather/${encodeURIComponent(icao)}`);

export const buscarRota = (adep: string, ades: string, aeronaveId?: string) => {
  const params = new URLSearchParams({ adep, ades });
  if (aeronaveId) params.set("aeronave_id", aeronaveId);
  return apiFetch<PlanoRota>(`/api/v1/flightplan?${params.toString()}`);
};

export function validarFpl(fpl: FormularioIcao): string[] {
  const erros: string[] = [];
  const adep = fpl.adep.trim().toUpperCase();
  const ades = fpl.ades.trim().toUpperCase();
  const identificacao = fpl.identificacao.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,7}$/.test(identificacao))
    erros.push("Item 7: identificação com 2 a 7 caracteres alfanuméricos.");
  if (!ICAO.test(adep)) erros.push("Item 13: informe um ADEP ICAO válido.");
  if (!ICAO.test(ades)) erros.push("Item 16: informe um ADES ICAO válido.");
  if (adep && ades && adep === ades)
    erros.push("A origem e o destino devem ser diferentes.");
  if (!/^\d{4}$/.test(fpl.eobt.replace(/:/g, "")))
    erros.push("Item 13: EOBT obrigatório no formato UTC HHMM.");
  if (!/^[A-Z0-9]{1,4}$/.test(fpl.tipoAeronave.trim().toUpperCase()))
    erros.push("Item 9: informe o designador ICAO da aeronave.");
  if (!fpl.equipamento.trim())
    erros.push("Item 10: informe o equipamento a bordo.");
  if (!/^[NKM]\d{4}$/.test(fpl.velocidade.trim().toUpperCase()))
    erros.push("Item 15: velocidade no formato ICAO, por exemplo N0150.");
  if (!/^(F|A|S|M)\d{3}$|^VFR$/i.test(fpl.nivel.trim()))
    erros.push(
      "Item 15: informe o nível no formato ICAO, por exemplo A045 ou VFR.",
    );
  if (!fpl.rota.trim()) erros.push("Item 15: informe a rota.");
  if (!/^\d{4}$/.test(fpl.eet.trim()))
    erros.push("Item 16: informe a EET em HHMM.");
  for (const [label, value] of [
    ["Alternado 1", fpl.alternado1],
    ["Alternado 2", fpl.alternado2],
  ]) {
    if (value.trim() && !ICAO.test(value.trim().toUpperCase()))
      erros.push(`${label}: use um código ICAO de quatro letras.`);
  }
  if (!/^\d{1,2}$/.test(fpl.pessoasABordo.trim()))
    erros.push("Item 19: informe o total de pessoas a bordo.");
  if (!fpl.autonomia.trim()) erros.push("Item 19: informe a autonomia.");
  if (!fpl.piloto.trim()) erros.push("Item 19: informe o piloto em comando.");
  if (!fpl.corAeronave.trim())
    erros.push("Item 19: informe a cor/marcas da aeronave.");
  return erros;
}

function juntar(...partes: string[]) {
  return partes
    .map((parte) => parte.trim())
    .filter(Boolean)
    .join(" ");
}

/** Gera texto para conferência e compartilhamento manual; não transmite ao SIGMA. */
export function gerarMensagemIcao(fpl: FormularioIcao): string {
  const eobt = fpl.eobt.replace(/:/g, "").trim();
  const alternados = [fpl.alternado1, fpl.alternado2]
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .join(" ");
  const outros = fpl.outrasInformacoes.trim().toUpperCase() || "0";
  const item19 = [
    fpl.autonomia.trim() && `E/${fpl.autonomia.trim().replace(":", "")}`,
    fpl.pessoasABordo.trim() && `P/${fpl.pessoasABordo.trim()}`,
    fpl.radioEmergencia.trim() && `R/${fpl.radioEmergencia.trim()}`,
    fpl.sobrevivencia.trim() && `S/${fpl.sobrevivencia.trim()}`,
    fpl.coletes.trim() && `J/${fpl.coletes.trim()}`,
    fpl.botes.trim() && `D/${fpl.botes.trim()}`,
    fpl.corAeronave.trim() && `A/${fpl.corAeronave.trim()}`,
    fpl.piloto.trim() && `C/${fpl.piloto.trim()}`,
  ].filter(Boolean);
  const main = [
    `(FPL-${fpl.identificacao.trim().toUpperCase()}`,
    `${fpl.regraVoo}${fpl.tipoVoo}`,
    `${fpl.numeroAeronaves.trim() || "1"}${fpl.tipoAeronave.trim().toUpperCase()}${fpl.esteira}`,
    fpl.equipamento.trim().toUpperCase(),
    `${fpl.adep.trim().toUpperCase()}${eobt}`,
    juntar(
      fpl.velocidade.trim().toUpperCase(),
      fpl.nivel.trim().toUpperCase(),
      fpl.rota.trim().toUpperCase(),
    ),
    juntar(fpl.ades.trim().toUpperCase(), fpl.eet.trim(), alternados),
    `-${outros})`,
  ].join("-");
  if (!item19.length && !fpl.observacoes.trim()) return main;
  const suplementar = [
    item19.length ? `ITEM 19 (SUPLEMENTAR): ${item19.join(" ")}` : "",
    fpl.observacoes.trim()
      ? `OBSERVAÇÕES PARA REVISÃO: ${fpl.observacoes.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  return `${main}\n\n${suplementar}\n\nO item 19 é informação suplementar. Revise o preenchimento e transmita somente pelo canal oficial autorizado.`;
}

export const mensagemErro = (e: unknown) =>
  e instanceof Error ? e.message : "Tente novamente.";

export function corMetar(metar?: string) {
  if (!metar) return "#6B7280";
  const u = metar.toUpperCase();
  if (u.includes("TS") || u.includes("FG") || u.includes("//"))
    return "#DC2626";
  if (u.includes("OVC") || u.includes("BKN0") || u.includes("SCT0"))
    return "#D97706";
  return "#16A34A";
}

export function formatarData(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function paraPlano(r: PlanoRegistro): PlanoVoo {
  const f: Partial<NovoPlano> = r.payload?.form ?? {};
  const legado = r.payload?.form ?? {};
  const contexto = r.payload?.contexto;
  const solicitacao = contexto?.solicitacao;
  const matricula =
    f.matricula ||
    contexto?.aeronave?.matricula_registro ||
    solicitacao?.matricula_registro ||
    "";
  const camposIcao = Object.keys(
    criarFormularioIcao(),
  ) as (keyof FormularioIcao)[];
  const fplLegado = Object.fromEntries(
    camposIcao
      .filter((campo) => campo !== "identificacao" || !solicitacao)
      .filter((campo) => typeof legado[campo] === "string")
      .map((campo) => [campo, legado[campo]]),
  ) as Partial<FormularioIcao>;
  const identificacaoMatricula = matricula
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
  const identificacaoLegada = String(legado.identificacao ?? "")
    .trim()
    .toUpperCase();
  const numeroVooLegado =
    !solicitacao &&
    identificacaoLegada ===
      String(r.numero_voo ?? "")
        .trim()
        .toUpperCase() &&
    /^[A-Z0-9]{2,7}$/.test(identificacaoLegada)
      ? ""
      : (r.numero_voo ?? "");
  const partida = r.adep || f.partida || "";
  const chegada = r.ades || f.chegada || "";
  return {
    id: r.id,
    numeroVoo:
      f.numeroVoo ??
      (solicitacao ? (solicitacao.numero_voo ?? "") : numeroVooLegado),
    solicitacaoId:
      f.solicitacaoId ??
      String(contexto?.solicitacao_id ?? solicitacao?.id ?? ""),
    partida,
    chegada,
    trecho: f.trecho ?? legado.rota ?? `${partida}-${chegada}`,
    data: r.data_voo || f.data || legado.dataVoo || hoje(),
    aeronave:
      f.aeronave ?? contexto?.aeronave?.modelo ?? solicitacao?.modelo ?? "",
    aeronaveId: f.aeronaveId ?? solicitacao?.aeronave_id ?? "",
    matricula,
    horaPrevista: formatarHoraUtc(
      f.horaPrevista ?? legado.eobt ?? r.eobt ?? "",
    ),
    estimativaVoo: f.estimativaVoo ?? "",
    combustivelPrevisto: f.combustivelPrevisto ?? 0,
    alternates: f.alternates ?? "",
    passageiros: f.passageiros ?? 0,
    peso: f.peso ?? 0,
    piloto: f.piloto ?? solicitacao?.piloto_nome ?? "",
    copiloto: f.copiloto ?? solicitacao?.copiloto_nome ?? "",
    observacoes: f.observacoes ?? "",
    condicoes: f.condicoes ?? "VMC",
    fpl: {
      ...criarFormularioIcao(),
      ...fplLegado,
      ...f.fpl,
      identificacao:
        f.fpl?.identificacao ||
        fplLegado.identificacao ||
        (/^[A-Z0-9]{2,7}$/.test(identificacaoMatricula)
          ? identificacaoMatricula
          : ""),
    },
    status: f.status ?? "rascunho",
  };
}

export function paraRegistro(p: NovoPlano) {
  return {
    numero_voo: p.numeroVoo.trim() || null,
    adep: p.partida,
    ades: p.chegada,
    data_voo: p.data,
    eobt: p.horaPrevista,
    aircraft_id: p.aeronaveId || undefined,
    form: p,
    contexto: p.solicitacaoId ? { solicitacao_id: p.solicitacaoId } : null,
    rota: p.fpl.rota || p.trecho || null,
    segmentos: [],
    distancia_total_nm: null,
    salvo_em: new Date().toISOString(),
  };
}
